import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { and, asc, eq, sql } from 'drizzle-orm';
import type {
  CreatePurchaseOrderDto,
  CreatePurchaseRequisitionDto,
  RecordGrnDto,
  RecordSupplierInvoiceDto,
  RegisterSupplierDto,
  SubmitRfqQuoteDto,
  VerifySupplierDto,
} from '@healthos/contracts';
import {
  goodsReceivedNotes,
  inventoryBatches,
  inventoryItems,
  purchaseOrders,
  purchaseRequisitions,
  rfqQuotes,
  stockMovements,
  supplierInvoices,
  suppliers,
  withTenantContext,
} from '@healthos/db';
import { AuditService } from '../audit/audit.service.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { CryptoService, DbService, type AccessTokenClaims } from '../security/security.module.js';

@Injectable()
export class ProcurementService {
  constructor(
    private readonly dbService: DbService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  async registerSupplier(actor: AccessTokenClaims, dto: RegisterSupplierDto, meta: RequestMeta) {
    const supplierId = randomUUID();
    const contactDetailsEncrypted = await this.crypto.cipher.encryptJson(
      {
        contactName: dto.contactName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        taxId: dto.taxId ?? null,
        bankDetails: dto.bankDetails ?? null,
      },
      {
        organizationId: actor.orgId,
        tableName: 'suppliers',
        recordId: supplierId,
        fieldName: 'contact_details',
      },
    );

    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(suppliers).values({
          id: supplierId,
          organizationId: actor.orgId,
          name: dto.name,
          category: dto.category,
          contactDetailsEncrypted,
        });
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: actor.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'SUPPLIER_REGISTERED',
      resourceType: 'supplier',
      resourceId: supplierId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { name: dto.name, category: dto.category },
    });

    return { supplierId, verificationStatus: 'PENDING' };
  }

  async verifySupplier(
    actor: AccessTokenClaims,
    supplierId: string,
    dto: VerifySupplierDto,
    meta: RequestMeta,
  ) {
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        await tx
          .update(suppliers)
          .set({
            verificationStatus: dto.verificationStatus,
            ...(dto.ratingScore !== undefined ? { ratingScore: dto.ratingScore } : {}),
            updatedAt: new Date(),
          })
          .where(and(eq(suppliers.id, supplierId), eq(suppliers.organizationId, actor.orgId)));
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: actor.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'SUPPLIER_VERIFICATION_UPDATED',
      resourceType: 'supplier',
      resourceId: supplierId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { verificationStatus: dto.verificationStatus },
    });

    return { supplierId, verificationStatus: dto.verificationStatus };
  }

  async createRequisition(actor: AccessTokenClaims, dto: CreatePurchaseRequisitionDto) {
    const requisitionId = randomUUID();
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(purchaseRequisitions).values({
          id: requisitionId,
          organizationId: actor.orgId,
          branchId: dto.branchId,
          requestedByUserId: actor.sub,
          items: dto.items,
          justification: dto.justification ?? null,
        });
      },
    );
    return { requisitionId, status: 'OPEN' };
  }

  async submitRfqQuote(actor: AccessTokenClaims, dto: SubmitRfqQuoteDto) {
    const quoteId = randomUUID();
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(rfqQuotes).values({
          id: quoteId,
          organizationId: actor.orgId,
          requisitionId: dto.requisitionId,
          supplierId: dto.supplierId,
          totalQuotedMinor: dto.totalQuotedMinor,
          leadTimeDays: dto.leadTimeDays,
          lineQuotes: dto.lineQuotes,
        });
        await tx
          .update(purchaseRequisitions)
          .set({ status: 'QUOTED' })
          .where(eq(purchaseRequisitions.id, dto.requisitionId));
      },
    );
    return { quoteId };
  }

  async compareQuotes(actor: AccessTokenClaims, requisitionId: string) {
    return withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        return tx
          .select({
            quoteId: rfqQuotes.id,
            supplierId: rfqQuotes.supplierId,
            supplierName: suppliers.name,
            supplierRating: suppliers.ratingScore,
            totalQuotedMinor: rfqQuotes.totalQuotedMinor,
            leadTimeDays: rfqQuotes.leadTimeDays,
            lineQuotes: rfqQuotes.lineQuotes,
          })
          .from(rfqQuotes)
          .innerJoin(suppliers, eq(rfqQuotes.supplierId, suppliers.id))
          .where(
            and(
              eq(rfqQuotes.organizationId, actor.orgId),
              eq(rfqQuotes.requisitionId, requisitionId),
            ),
          )
          .orderBy(asc(rfqQuotes.totalQuotedMinor));
      },
    );
  }

  async createPurchaseOrder(
    actor: AccessTokenClaims,
    dto: CreatePurchaseOrderDto,
    meta: RequestMeta,
  ) {
    const poId = randomUUID();
    const poNumber = `PO-${new Date().getUTCFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const totalAmountMinor = dto.items.reduce((sum, i) => sum + i.quantity * i.unitPriceMinor, 0);

    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        const [supplier] = await tx
          .select()
          .from(suppliers)
          .where(and(eq(suppliers.id, dto.supplierId), eq(suppliers.organizationId, actor.orgId)))
          .limit(1);

        if (!supplier || supplier.verificationStatus !== 'VERIFIED') {
          throw new BadRequestException('Purchase orders can only be issued to VERIFIED suppliers.');
        }

        await tx.insert(purchaseOrders).values({
          id: poId,
          organizationId: actor.orgId,
          branchId: dto.branchId,
          supplierId: dto.supplierId,
          requisitionId: dto.requisitionId ?? null,
          poNumber,
          totalAmountMinor,
          items: dto.items,
          createdByUserId: actor.sub,
          expectedDeliveryAt: dto.expectedDeliveryAt ? new Date(dto.expectedDeliveryAt) : null,
        });
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: dto.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'PURCHASE_ORDER_CREATED',
      resourceType: 'purchase_order',
      resourceId: poId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { poNumber, totalAmountMinor },
    });

    return { poId, poNumber, totalAmountMinor, status: 'PENDING_APPROVAL' };
  }

  async approvePurchaseOrder(actor: AccessTokenClaims, poId: string, meta: RequestMeta) {
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        const [po] = await tx
          .select()
          .from(purchaseOrders)
          .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.organizationId, actor.orgId)))
          .limit(1);

        if (!po) throw new NotFoundException('Purchase order not found.');
        if (po.status !== 'PENDING_APPROVAL') {
          throw new BadRequestException(`PO is already in status ${po.status}.`);
        }

        await tx
          .update(purchaseOrders)
          .set({ status: 'APPROVED', approvedByUserId: actor.sub, updatedAt: new Date() })
          .where(eq(purchaseOrders.id, poId));
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: actor.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'PURCHASE_ORDER_APPROVED',
      resourceType: 'purchase_order',
      resourceId: poId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { poId, status: 'APPROVED' };
  }

  async recordGrn(actor: AccessTokenClaims, dto: RecordGrnDto, meta: RequestMeta) {
    const grnId = randomUUID();

    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: actor.branchId, actorId: actor.sub },
      async (tx) => {
        const [po] = await tx
          .select()
          .from(purchaseOrders)
          .where(
            and(
              eq(purchaseOrders.id, dto.purchaseOrderId),
              eq(purchaseOrders.organizationId, actor.orgId),
            ),
          )
          .limit(1);

        if (!po) throw new NotFoundException('Purchase order not found.');
        if (po.status !== 'APPROVED') {
          throw new BadRequestException('GRN requires an APPROVED purchase order.');
        }

        await tx.insert(goodsReceivedNotes).values({
          id: grnId,
          organizationId: actor.orgId,
          branchId: po.branchId,
          purchaseOrderId: po.id,
          deliveryNoteNumber: dto.deliveryNoteNumber,
          receivedItems: dto.receivedItems,
          notes: dto.notes ?? null,
          receivedByUserId: actor.sub,
        });

        for (const item of dto.receivedItems) {
          if (item.inventoryItemId) {
            const batchId = randomUUID();
            await tx.insert(inventoryBatches).values({
              id: batchId,
              organizationId: actor.orgId,
              branchId: po.branchId,
              itemId: item.inventoryItemId,
              batchNumber: item.batchNumber,
              quantityOnHand: item.quantityReceived,
              unitCostMinor: item.unitCostMinor,
              expiresAt: item.expiresAt ? new Date(item.expiresAt) : null,
            });
            await tx.insert(stockMovements).values({
              organizationId: actor.orgId,
              branchId: po.branchId,
              itemId: item.inventoryItemId,
              batchId,
              movementType: 'RECEIVE',
              quantityDelta: item.quantityReceived,
              notes: `GRN ${dto.deliveryNoteNumber} for PO ${po.poNumber}`,
              performedByUserId: actor.sub,
            });
          }
        }

        await tx
          .update(purchaseOrders)
          .set({ status: 'RECEIVED', updatedAt: new Date() })
          .where(eq(purchaseOrders.id, po.id));
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: actor.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'PROCUREMENT_GRN_RECORDED',
      resourceType: 'goods_received_note',
      resourceId: grnId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { purchaseOrderId: dto.purchaseOrderId, deliveryNote: dto.deliveryNoteNumber },
    });

    return { grnId, status: 'RECEIVED' };
  }

  async recordSupplierInvoice(actor: AccessTokenClaims, dto: RecordSupplierInvoiceDto) {
    const invoiceId = randomUUID();
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(supplierInvoices).values({
          id: invoiceId,
          organizationId: actor.orgId,
          purchaseOrderId: dto.purchaseOrderId,
          supplierId: dto.supplierId,
          invoiceNumber: dto.invoiceNumber,
          amountMinor: dto.amountMinor,
          dueDate: new Date(dto.dueDate),
        });
      },
    );
    return { invoiceId, paymentStatus: 'UNPAID' };
  }

  async getReorderRecommendations(actor: AccessTokenClaims, branchId: string) {
    return withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId, actorId: actor.sub },
      async (tx) => {
        const rows = await tx
          .select({
            itemId: inventoryItems.id,
            sku: inventoryItems.sku,
            name: inventoryItems.name,
            reorderLevel: inventoryItems.reorderLevel,
            currentQty: sql<number>`coalesce(sum(${inventoryBatches.quantityOnHand}), 0)`,
          })
          .from(inventoryItems)
          .leftJoin(
            inventoryBatches,
            and(
              eq(inventoryBatches.itemId, inventoryItems.id),
              eq(inventoryBatches.branchId, branchId),
            ),
          )
          .where(eq(inventoryItems.organizationId, actor.orgId))
          .groupBy(inventoryItems.id, inventoryItems.sku, inventoryItems.name, inventoryItems.reorderLevel);

        return rows
          .filter((r) => Number(r.currentQty) <= r.reorderLevel)
          .map((r) => ({
            ...r,
            currentQty: Number(r.currentQty),
            recommendedOrderQty: Math.max(r.reorderLevel * 2 - Number(r.currentQty), r.reorderLevel),
          }));
      },
    );
  }
}
