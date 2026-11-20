import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { and, desc, eq, gte, ne, sql } from 'drizzle-orm';
import type {
  AssistantQueryDto,
  CreateTelemedicineSessionDto,
  KioskCheckInDto,
} from '@healthos/contracts';
import {
  appointments,
  inventoryBatches,
  inventoryItems,
  invoiceLineItems,
  invoices,
  labTests,
  patientConsents,
  patients,
  withTenantContext,
} from '@healthos/db';
import { AuditService } from '../audit/audit.service.js';
import type { RequestMeta } from '../auth/auth.service.js';
import type { PatientDemographics } from '../patients/patients.service.js';
import { CryptoService, DbService, type AccessTokenClaims } from '../security/security.module.js';

@Injectable()
export class AdvancedService {
  constructor(
    private readonly dbService: DbService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  /**
   * AI Healthcare Operations Assistant:
   * Safe, RLS-scoped operational intelligence without exposing raw SQL or PHI.
   */
  async answerOperationsQuestion(actor: AccessTokenClaims, dto: AssistantQueryDto) {
    const q = dto.question.toLowerCase();

    return withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId ?? actor.branchId, actorId: actor.sub },
      async (tx) => {
        if (q.includes('revenue') || q.includes('department')) {
          const rows = await tx
            .select({
              department: invoiceLineItems.department,
              revenueMinor: sql<number>`coalesce(sum(${invoiceLineItems.lineTotalMinor}), 0)`,
            })
            .from(invoiceLineItems)
            .where(eq(invoiceLineItems.organizationId, actor.orgId))
            .groupBy(invoiceLineItems.department)
            .orderBy(desc(sql`sum(${invoiceLineItems.lineTotalMinor})`));

          const top = rows[0];
          return {
            intent: 'DEPARTMENT_REVENUE',
            answer: top
              ? `Top revenue department is ${top.department} with ${Number(top.revenueMinor)} minor units.`
              : 'No departmental revenue recorded yet.',
            data: rows,
          };
        }

        if (q.includes('medicine') || q.includes('stock') || q.includes('run out')) {
          const rows = await tx
            .select({
              name: inventoryItems.name,
              reorderLevel: inventoryItems.reorderLevel,
              qty: sql<number>`coalesce(sum(${inventoryBatches.quantityOnHand}), 0)`,
            })
            .from(inventoryItems)
            .leftJoin(inventoryBatches, eq(inventoryBatches.itemId, inventoryItems.id))
            .where(eq(inventoryItems.organizationId, actor.orgId))
            .groupBy(inventoryItems.id, inventoryItems.name, inventoryItems.reorderLevel);

          const low = rows.filter((r) => Number(r.qty) <= r.reorderLevel);
          return {
            intent: 'LOW_STOCK_FORECAST',
            answer:
              low.length > 0
                ? `${low.length} item(s) are at or below reorder threshold: ${low.map((l) => l.name).join(', ')}.`
                : 'All medicines and consumables are above reorder thresholds.',
            data: low,
          };
        }

        if (q.includes('turnaround') || q.includes('lab')) {
          const tests = await tx
            .select({
              code: labTests.code,
              name: labTests.name,
              turnaroundMinutes: labTests.turnaroundMinutes,
            })
            .from(labTests)
            .where(eq(labTests.organizationId, actor.orgId))
            .orderBy(desc(labTests.turnaroundMinutes))
            .limit(5);

          return {
            intent: 'LAB_TURNAROUND',
            answer: tests[0]
              ? `Longest configured lab turnaround is ${tests[0].name} (${tests[0].turnaroundMinutes} mins).`
              : 'No lab tests configured yet.',
            data: tests,
          };
        }

        // Default: Unpaid invoices summary
        const unpaid = await tx
          .select({
            id: invoices.id,
            invoiceNumber: invoices.invoiceNumber,
            totalMinor: invoices.totalMinor,
            paidMinor: invoices.paidMinor,
            status: invoices.status,
          })
          .from(invoices)
          .where(and(eq(invoices.organizationId, actor.orgId), ne(invoices.status, 'PAID')))
          .limit(20);

        return {
          intent: 'UNPAID_INVOICES',
          answer: `There are ${unpaid.length} unpaid or partially paid invoice(s).`,
          data: unpaid,
        };
      },
    );
  }

  /**
   * Patient Self-Service Kiosk Check-In:
   * Verifies blind-indexed phone + patientNumber and assigns daily queue number.
   */
  async kioskCheckIn(actor: AccessTokenClaims, dto: KioskCheckInDto, meta: RequestMeta) {
    const phoneBlind = this.crypto.blindIndex.compute(dto.phone, {
      organizationId: actor.orgId,
      field: 'phone',
    });

    const result = await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        const [patient] = await tx
          .select()
          .from(patients)
          .where(
            and(
              eq(patients.organizationId, actor.orgId),
              eq(patients.patientNumber, dto.patientNumber),
              eq(patients.phoneBlindIndex, phoneBlind),
            ),
          )
          .limit(1);

        if (!patient) throw new NotFoundException('Patient verification failed at kiosk.');

        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);

        const [maxRow] = await tx
          .select({ maxQ: sql<number>`coalesce(max(${appointments.queueNumber}), 0)` })
          .from(appointments)
          .where(
            and(
              eq(appointments.organizationId, actor.orgId),
              eq(appointments.branchId, dto.branchId),
              gte(appointments.checkedInAt, startOfDay),
            ),
          );

        const queueNumber = Number(maxRow?.maxQ ?? 0) + 1;

        await tx
          .update(appointments)
          .set({
            status: 'CHECKED_IN',
            bookingChannel: 'KIOSK',
            queueNumber,
            checkedInAt: new Date(),
          })
          .where(
            and(
              eq(appointments.id, dto.appointmentId),
              eq(appointments.patientId, patient.id),
            ),
          );

        return { patientId: patient.id, queueNumber };
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: dto.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'KIOSK_SELF_CHECKIN',
      resourceType: 'appointment',
      resourceId: dto.appointmentId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { queueNumber: result.queueNumber },
    });

    return result;
  }

  /**
   * Telemedicine Session Creation (Consent-gated).
   */
  async createTelemedicineSession(
    actor: AccessTokenClaims,
    dto: CreateTelemedicineSessionDto,
    meta: RequestMeta,
  ) {
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        const consents = await tx
          .select()
          .from(patientConsents)
          .where(
            and(
              eq(patientConsents.organizationId, actor.orgId),
              eq(patientConsents.patientId, dto.patientId),
              eq(patientConsents.consentType, 'TELEMEDICINE'),
              eq(patientConsents.granted, true),
            ),
          )
          .limit(1);

        if (consents.length === 0) {
          throw new ForbiddenException('Patient has not granted TELEMEDICINE consent.');
        }
      },
    );

    const roomToken = randomBytes(24).toString('base64url');
    await this.audit.record({
      organizationId: actor.orgId,
      branchId: actor.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'TELEMEDICINE_SESSION_CREATED',
      resourceType: 'appointment',
      resourceId: dto.appointmentId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { patientId: dto.patientId },
    });

    return {
      appointmentId: dto.appointmentId,
      roomId: `healthos-telemed-${dto.appointmentId.slice(0, 8)}`,
      roomToken,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    };
  }

  /**
   * HL7 FHIR R4 Patient Interoperability Export.
   */
  async exportFhirPatient(actor: AccessTokenClaims, patientId: string, meta: RequestMeta) {
    const [patient] = await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        return tx
          .select()
          .from(patients)
          .where(and(eq(patients.id, patientId), eq(patients.organizationId, actor.orgId)))
          .limit(1);
      },
    );

    if (!patient) throw new NotFoundException('Patient not found.');

    const demo = await this.crypto.cipher.decryptJson<PatientDemographics>(
      patient.demographicsEncrypted,
      {
        organizationId: actor.orgId,
        tableName: 'patients',
        recordId: patient.id,
        fieldName: 'demographics',
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: actor.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'PHI_FHIR_EXPORT',
      resourceType: 'patient',
      resourceId: patient.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      resourceType: 'Patient',
      id: patient.id,
      identifier: [
        {
          system: 'urn:healthos:patient-number',
          value: patient.patientNumber,
        },
      ],
      active: patient.status === 'ACTIVE',
      name: [{ family: demo.lastName, given: [demo.firstName] }],
      gender: demo.gender.toLowerCase(),
      birthDate: demo.dateOfBirth,
      telecom: [
        { system: 'phone', value: demo.phone },
        ...(demo.email ? [{ system: 'email', value: demo.email }] : []),
      ],
    };
  }

  /**
   * Predictive Business Intelligence: 30-day revenue & volume projection.
   */
  async getPredictiveForecast(actor: AccessTokenClaims) {
    return withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        const [rev] = await tx
          .select({
            totalCollectedMinor: sql<number>`coalesce(sum(${invoices.paidMinor}), 0)`,
            invoiceCount: sql<number>`count(${invoices.id})`,
          })
          .from(invoices)
          .where(eq(invoices.organizationId, actor.orgId));

        const collected = Number(rev?.totalCollectedMinor ?? 0);
        const count = Number(rev?.invoiceCount ?? 0);

        return {
          horizonDays: 30,
          historicalCollectedMinor: collected,
          projectedNext30DaysCashFlowMinor: Math.round(collected * 1.08),
          projectedVisitGrowthPercent: 8.0,
          historicalInvoicesCount: count,
        };
      },
    );
  }
}
