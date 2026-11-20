import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import type {
  CreateInvoiceDto,
  ReconcileHmoClaimDto,
  RecordPaymentDto,
  RefundPaymentDto,
  SubmitHmoClaimDto,
  UpsertServicePriceDto,
} from '@healthos/contracts';
import {
  hmoClaims,
  invoiceLineItems,
  invoices,
  patients,
  payments,
  serviceCatalog,
  withTenantContext,
} from '@healthos/db';
import { AuditService } from '../audit/audit.service.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { CryptoService, DbService, type AccessTokenClaims } from '../security/security.module.js';

@Injectable()
export class BillingService {
  constructor(
    private readonly dbService: DbService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  async upsertServicePrice(actor: AccessTokenClaims, dto: UpsertServicePriceDto) {
    const id = randomUUID();
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        await tx
          .insert(serviceCatalog)
          .values({
            id,
            organizationId: actor.orgId,
            code: dto.code.toUpperCase(),
            name: dto.name,
            department: dto.department,
            priceMinor: dto.priceMinor,
          })
          .onConflictDoUpdate({
            target: [serviceCatalog.organizationId, serviceCatalog.code],
            set: {
              name: dto.name,
              department: dto.department,
              priceMinor: dto.priceMinor,
              updatedAt: new Date(),
            },
          });
      },
    );
    return { code: dto.code.toUpperCase(), priceMinor: dto.priceMinor };
  }

  async createInvoice(actor: AccessTokenClaims, dto: CreateInvoiceDto, meta: RequestMeta) {
    const invoiceId = randomUUID();
    const invoiceNumber = `INV-${new Date().getUTCFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`;

    const subtotalMinor = dto.items.reduce((sum, item) => sum + item.quantity * item.unitPriceMinor, 0);
    if (dto.discountMinor > subtotalMinor) {
      throw new BadRequestException('Discount cannot exceed subtotal.');
    }
    const totalMinor = subtotalMinor - dto.discountMinor;

    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(invoices).values({
          id: invoiceId,
          organizationId: actor.orgId,
          branchId: dto.branchId,
          patientId: dto.patientId,
          invoiceNumber,
          subtotalMinor,
          discountMinor: dto.discountMinor,
          totalMinor,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          createdByUserId: actor.sub,
        });

        await tx.insert(invoiceLineItems).values(
          dto.items.map((item) => ({
            organizationId: actor.orgId,
            branchId: dto.branchId,
            invoiceId,
            department: item.department,
            description: item.description,
            quantity: item.quantity,
            unitPriceMinor: item.unitPriceMinor,
            lineTotalMinor: item.quantity * item.unitPriceMinor,
            referenceType: item.referenceType ?? null,
            referenceId: item.referenceId ?? null,
          })),
        );
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: dto.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'BILLING_INVOICE_CREATED',
      resourceType: 'invoice',
      resourceId: invoiceId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { invoiceNumber, totalMinor, lineCount: dto.items.length },
    });

    return { invoiceId, invoiceNumber, totalMinor, status: 'UNPAID' };
  }

  async recordPayment(actor: AccessTokenClaims, dto: RecordPaymentDto, meta: RequestMeta) {
    const paymentId = randomUUID();

    const result = await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        if (dto.idempotencyKey) {
          const [existing] = await tx
            .select()
            .from(payments)
            .where(
              and(
                eq(payments.organizationId, actor.orgId),
                eq(payments.idempotencyKey, dto.idempotencyKey),
              ),
            )
            .limit(1);
          if (existing) {
            return { paymentId: existing.id, duplicate: true };
          }
        }

        if (dto.invoiceId) {
          const [inv] = await tx
            .select()
            .from(invoices)
            .where(and(eq(invoices.id, dto.invoiceId), eq(invoices.organizationId, actor.orgId)))
            .limit(1);

          if (!inv) throw new NotFoundException('Invoice not found.');
          if (inv.status === 'VOID') throw new BadRequestException('Cannot pay a void invoice.');

          const newPaid = inv.paidMinor + dto.amountMinor;
          const newStatus = newPaid >= inv.totalMinor ? 'PAID' : 'PARTIAL';

          await tx
            .update(invoices)
            .set({ paidMinor: newPaid, status: newStatus, updatedAt: new Date() })
            .where(eq(invoices.id, inv.id));
        }

        await tx.insert(payments).values({
          id: paymentId,
          organizationId: actor.orgId,
          branchId: dto.branchId,
          patientId: dto.patientId,
          invoiceId: dto.invoiceId ?? null,
          amountMinor: dto.amountMinor,
          paymentMethod: dto.paymentMethod,
          isDeposit: dto.isDeposit,
          gatewayReference: dto.gatewayReference ?? null,
          idempotencyKey: dto.idempotencyKey ?? null,
          cashierUserId: actor.sub,
        });

        return { paymentId, duplicate: false };
      },
    );

    if (!result.duplicate) {
      await this.audit.record({
        organizationId: actor.orgId,
        branchId: dto.branchId,
        actorId: actor.sub,
        actorRole: actor.role,
        action: 'BILLING_PAYMENT_RECORDED',
        resourceType: 'payment',
        resourceId: paymentId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: {
          amountMinor: dto.amountMinor,
          paymentMethod: dto.paymentMethod,
          invoiceId: dto.invoiceId ?? null,
        },
      });
    }

    return result;
  }

  async refundPayment(actor: AccessTokenClaims, dto: RefundPaymentDto, meta: RequestMeta) {
    const refundId = randomUUID();

    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: actor.branchId, actorId: actor.sub },
      async (tx) => {
        const [orig] = await tx
          .select()
          .from(payments)
          .where(and(eq(payments.id, dto.paymentId), eq(payments.organizationId, actor.orgId)))
          .limit(1);

        if (!orig) throw new NotFoundException('Original payment not found.');
        if (orig.isRefund) throw new BadRequestException('Cannot refund a refund.');
        if (dto.amountMinor > orig.amountMinor) {
          throw new BadRequestException('Refund amount exceeds original payment.');
        }

        await tx.insert(payments).values({
          id: refundId,
          organizationId: actor.orgId,
          branchId: orig.branchId,
          patientId: orig.patientId,
          invoiceId: orig.invoiceId,
          amountMinor: -dto.amountMinor,
          paymentMethod: orig.paymentMethod,
          isRefund: true,
          refundReason: dto.reason,
          cashierUserId: actor.sub,
        });

        if (orig.invoiceId) {
          const [inv] = await tx
            .select()
            .from(invoices)
            .where(eq(invoices.id, orig.invoiceId))
            .limit(1);
          if (inv) {
            const updatedPaid = Math.max(0, inv.paidMinor - dto.amountMinor);
            const updatedStatus =
              updatedPaid === 0 ? 'UNPAID' : updatedPaid >= inv.totalMinor ? 'PAID' : 'PARTIAL';
            await tx
              .update(invoices)
              .set({ paidMinor: updatedPaid, status: updatedStatus, updatedAt: new Date() })
              .where(eq(invoices.id, inv.id));
          }
        }
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: actor.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'BILLING_REFUND_ISSUED',
      resourceType: 'payment',
      resourceId: refundId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { originalPaymentId: dto.paymentId, amountMinor: dto.amountMinor },
    });

    return { refundId, status: 'REFUNDED' };
  }

  async submitHmoClaim(actor: AccessTokenClaims, dto: SubmitHmoClaimDto, meta: RequestMeta) {
    const claimId = randomUUID();
    const policyNumberEncrypted = await this.crypto.cipher.encryptString(dto.policyNumber, {
      organizationId: actor.orgId,
      tableName: 'hmo_claims',
      recordId: claimId,
      fieldName: 'policy_number',
    });

    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(hmoClaims).values({
          id: claimId,
          organizationId: actor.orgId,
          branchId: dto.branchId,
          invoiceId: dto.invoiceId,
          patientId: dto.patientId,
          hmoProvider: dto.hmoProvider,
          policyNumberEncrypted,
          claimedAmountMinor: dto.claimedAmountMinor,
          submittedByUserId: actor.sub,
        });
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: dto.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'HMO_CLAIM_SUBMITTED',
      resourceType: 'hmo_claim',
      resourceId: claimId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { hmoProvider: dto.hmoProvider, claimedAmountMinor: dto.claimedAmountMinor },
    });

    return { claimId, status: 'SUBMITTED' };
  }

  async reconcileHmoClaim(
    actor: AccessTokenClaims,
    claimId: string,
    dto: ReconcileHmoClaimDto,
    meta: RequestMeta,
  ) {
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        const [claim] = await tx
          .select()
          .from(hmoClaims)
          .where(and(eq(hmoClaims.id, claimId), eq(hmoClaims.organizationId, actor.orgId)))
          .limit(1);

        if (!claim) throw new NotFoundException('HMO claim not found.');
        if (claim.status === 'PAID') throw new ConflictException('Claim is already paid.');

        await tx
          .update(hmoClaims)
          .set({
            status: dto.status,
            approvedAmountMinor: dto.approvedAmountMinor,
            settlementReference: dto.settlementReference ?? null,
            updatedAt: new Date(),
          })
          .where(eq(hmoClaims.id, claimId));

        if (dto.status === 'PAID' && dto.approvedAmountMinor > 0) {
          await tx.insert(payments).values({
            organizationId: actor.orgId,
            branchId: claim.branchId,
            patientId: claim.patientId,
            invoiceId: claim.invoiceId,
            amountMinor: dto.approvedAmountMinor,
            paymentMethod: 'HMO',
            gatewayReference: dto.settlementReference ?? null,
            cashierUserId: actor.sub,
          });

          const [inv] = await tx
            .select()
            .from(invoices)
            .where(eq(invoices.id, claim.invoiceId))
            .limit(1);
          if (inv) {
            const newPaid = inv.paidMinor + dto.approvedAmountMinor;
            await tx
              .update(invoices)
              .set({
                paidMinor: newPaid,
                status: newPaid >= inv.totalMinor ? 'PAID' : 'PARTIAL',
                updatedAt: new Date(),
              })
              .where(eq(invoices.id, inv.id));
          }
        }
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: actor.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'HMO_CLAIM_RECONCILED',
      resourceType: 'hmo_claim',
      resourceId: claimId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { status: dto.status, approvedAmountMinor: dto.approvedAmountMinor },
    });

    return { claimId, status: dto.status };
  }

  async getPatientStatement(actor: AccessTokenClaims, patientId: string) {
    return withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        if (actor.role === 'PATIENT') {
          const [pat] = await tx
            .select({ portalUserId: patients.portalUserId })
            .from(patients)
            .where(and(eq(patients.id, patientId), eq(patients.organizationId, actor.orgId)))
            .limit(1);
          if (!pat || pat.portalUserId !== actor.sub) {
            throw new ForbiddenException('Patients can only view their own billing statement.');
          }
        }

        const patientInvoices = await tx
          .select()
          .from(invoices)
          .where(and(eq(invoices.organizationId, actor.orgId), eq(invoices.patientId, patientId)))
          .orderBy(desc(invoices.createdAt));
        const patientPayments = await tx
          .select()
          .from(payments)
          .where(and(eq(payments.organizationId, actor.orgId), eq(payments.patientId, patientId)))
          .orderBy(desc(payments.recordedAt));

        const totalBilledMinor = patientInvoices.reduce((s, i) => s + i.totalMinor, 0);
        const totalPaidMinor = patientPayments.reduce((s, p) => s + p.amountMinor, 0);

        return {
          patientId,
          totalBilledMinor,
          totalPaidMinor,
          outstandingBalanceMinor: Math.max(0, totalBilledMinor - totalPaidMinor),
          invoices: patientInvoices,
          payments: patientPayments,
        };
      },
    );
  }

  async getDepartmentalRevenueReport(actor: AccessTokenClaims, branchId?: string) {
    return withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: branchId ?? actor.branchId, actorId: actor.sub },
      async (tx) => {
        const conditions = [eq(invoiceLineItems.organizationId, actor.orgId)];
        if (branchId) conditions.push(eq(invoiceLineItems.branchId, branchId));

        return tx
          .select({
            department: invoiceLineItems.department,
            billedRevenueMinor: sql<number>`coalesce(sum(${invoiceLineItems.lineTotalMinor}), 0)`,
          })
          .from(invoiceLineItems)
          .where(and(...conditions))
          .groupBy(invoiceLineItems.department);
      },
    );
  }
}
