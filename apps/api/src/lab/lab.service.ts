import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, count, desc, eq } from 'drizzle-orm';
import type {
  CreateLabOrderDto,
  CreateLabTestDto,
  EnterLabResultDto,
  RecordLabQcDto,
  RegisterSampleDto,
  UpdateSampleStatusDto,
  UpsertLabReagentDto,
} from '@healthos/contracts';
import {
  labOrders,
  labQcRecords,
  labReagents,
  labResults,
  labSamples,
  labTests,
  patients,
  withTenantContext,
} from '@healthos/db';
import { AuditService } from '../audit/audit.service.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { CryptoService, DbService, type AccessTokenClaims } from '../security/security.module.js';

export interface LabResultPayload {
  parameters: EnterLabResultDto['parameters'];
  interpretation?: string;
}

function applyAutoCalculations(
  rule: string,
  params: EnterLabResultDto['parameters'],
): EnterLabResultDto['parameters'] {
  const result = [...params];
  const findNum = (name: string) => {
    const found = result.find((p) => p.name.toLowerCase() === name.toLowerCase());
    return found && typeof found.value === 'number' ? found.value : null;
  };

  if (rule === 'LDL_FRIEDEWALD') {
    const tc = findNum('Total Cholesterol');
    const hdl = findNum('HDL');
    const tg = findNum('Triglycerides');
    if (tc !== null && hdl !== null && tg !== null && tg < 400) {
      const ldl = Number((tc - hdl - tg / 5).toFixed(2));
      result.push({ name: 'LDL (Calculated)', value: ldl, unit: 'mg/dL' });
    }
  } else if (rule === 'AG_RATIO') {
    const alb = findNum('Albumin');
    const tp = findNum('Total Protein');
    if (alb !== null && tp !== null && tp > alb) {
      const ratio = Number((alb / (tp - alb)).toFixed(2));
      result.push({ name: 'A/G Ratio (Calculated)', value: ratio, unit: 'ratio' });
    }
  }

  return result;
}

@Injectable()
export class LabService {
  constructor(
    private readonly dbService: DbService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  async createTest(actor: AccessTokenClaims, dto: CreateLabTestDto) {
    const testId = randomUUID();
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(labTests).values({
          id: testId,
          organizationId: actor.orgId,
          code: dto.code.toUpperCase(),
          name: dto.name,
          category: dto.category,
          specimenType: dto.specimenType,
          priceMinor: dto.priceMinor,
          turnaroundMinutes: dto.turnaroundMinutes,
          referenceRanges: dto.referenceRanges,
          autoCalculationRule: dto.autoCalculationRule,
        });
      },
    );
    return { testId, code: dto.code.toUpperCase() };
  }

  async listTests(actor: AccessTokenClaims) {
    return withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        return tx
          .select()
          .from(labTests)
          .where(and(eq(labTests.organizationId, actor.orgId), eq(labTests.isActive, true)));
      },
    );
  }

  async createOrder(actor: AccessTokenClaims, dto: CreateLabOrderDto, meta: RequestMeta) {
    const orderId = randomUUID();
    const clinicalNotesEncrypted = dto.clinicalNotes
      ? await this.crypto.cipher.encryptString(dto.clinicalNotes, {
          organizationId: actor.orgId,
          tableName: 'lab_orders',
          recordId: orderId,
          fieldName: 'clinical_notes',
        })
      : null;

    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(labOrders).values({
          id: orderId,
          organizationId: actor.orgId,
          branchId: dto.branchId,
          patientId: dto.patientId,
          consultationId: dto.consultationId ?? null,
          testId: dto.testId,
          orderedByUserId: actor.sub,
          priority: dto.priority,
          externalReferralLab: dto.externalReferralLab ?? null,
          clinicalNotesEncrypted,
        });
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: dto.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'LAB_ORDER_CREATED',
      resourceType: 'lab_order',
      resourceId: orderId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { patientId: dto.patientId, testId: dto.testId, priority: dto.priority },
    });

    return { orderId, status: 'REQUESTED' };
  }

  async registerSample(actor: AccessTokenClaims, dto: RegisterSampleDto, meta: RequestMeta) {
    const sampleId = randomUUID();
    const sampleBarcode = `LAB-${randomBytes(4).toString('hex').toUpperCase()}`;

    const result = await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: actor.branchId, actorId: actor.sub },
      async (tx) => {
        const [order] = await tx
          .select()
          .from(labOrders)
          .where(and(eq(labOrders.id, dto.orderId), eq(labOrders.organizationId, actor.orgId)))
          .limit(1);

        if (!order) throw new NotFoundException('Lab order not found.');

        const [existingResult] = await tx
          .select({ id: labResults.id })
          .from(labResults)
          .where(eq(labResults.orderId, order.id))
          .limit(1);
        if (existingResult) {
          throw new ConflictException('A result has already been entered for this lab order.');
        }

        const qrPayload = JSON.stringify({
          v: 1,
          orgId: actor.orgId,
          orderId: order.id,
          barcode: sampleBarcode,
        });

        await tx.insert(labSamples).values({
          id: sampleId,
          organizationId: actor.orgId,
          branchId: order.branchId,
          orderId: order.id,
          sampleBarcode,
          qrPayload,
          specimenType: dto.specimenType,
          collectedByUserId: actor.sub,
          assignedTechnicianId: dto.assignedTechnicianId ?? null,
        });

        await tx
          .update(labOrders)
          .set({ status: 'SAMPLE_COLLECTED', updatedAt: new Date() })
          .where(eq(labOrders.id, order.id));

        return { sampleId, sampleBarcode, qrPayload, branchId: order.branchId };
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: result.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'LAB_SAMPLE_COLLECTED',
      resourceType: 'lab_sample',
      resourceId: sampleId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { orderId: dto.orderId, barcode: sampleBarcode },
    });

    return result;
  }

  async updateSampleStatus(
    actor: AccessTokenClaims,
    sampleId: string,
    dto: UpdateSampleStatusDto,
    meta: RequestMeta,
  ) {
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: actor.branchId, actorId: actor.sub },
      async (tx) => {
        const [sample] = await tx
          .select()
          .from(labSamples)
          .where(and(eq(labSamples.id, sampleId), eq(labSamples.organizationId, actor.orgId)))
          .limit(1);

        if (!sample) throw new NotFoundException('Lab sample not found.');

        await tx
          .update(labSamples)
          .set({
            status: dto.status,
            rejectionReason: dto.rejectionReason ?? null,
            updatedAt: new Date(),
          })
          .where(eq(labSamples.id, sampleId));

        if (dto.status === 'PROCESSING') {
          await tx
            .update(labOrders)
            .set({ status: 'PROCESSING', updatedAt: new Date() })
            .where(eq(labOrders.id, sample.orderId));
        }
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: actor.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'LAB_SAMPLE_STATUS_UPDATED',
      resourceType: 'lab_sample',
      resourceId: sampleId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { status: dto.status },
    });

    return { sampleId, status: dto.status };
  }

  async enterResult(actor: AccessTokenClaims, dto: EnterLabResultDto, meta: RequestMeta) {
    const resultId = randomUUID();

    const { patientId, branchId, computedParameters } = await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: actor.branchId, actorId: actor.sub },
      async (tx) => {
        const [order] = await tx
          .select()
          .from(labOrders)
          .where(and(eq(labOrders.id, dto.orderId), eq(labOrders.organizationId, actor.orgId)))
          .limit(1);

        if (!order) throw new NotFoundException('Lab order not found.');

        const [existingResult] = await tx
          .select({ id: labResults.id })
          .from(labResults)
          .where(eq(labResults.orderId, order.id))
          .limit(1);
        if (existingResult) {
          throw new ConflictException('A result has already been entered for this lab order.');
        }

        const [test] = await tx
          .select()
          .from(labTests)
          .where(eq(labTests.id, order.testId))
          .limit(1);

        const computed = applyAutoCalculations(test?.autoCalculationRule ?? 'NONE', dto.parameters);

        const payloadEncrypted = await this.crypto.cipher.encryptJson(
          { parameters: computed, interpretation: dto.interpretation },
          {
            organizationId: actor.orgId,
            tableName: 'lab_results',
            recordId: resultId,
            fieldName: 'result_payload',
          },
        );

        await tx.insert(labResults).values({
          id: resultId,
          organizationId: actor.orgId,
          branchId: order.branchId,
          orderId: order.id,
          patientId: order.patientId,
          resultPayloadEncrypted: payloadEncrypted,
          enteredByUserId: actor.sub,
        });

        await tx
          .update(labOrders)
          .set({ status: 'RESULT_ENTERED', updatedAt: new Date() })
          .where(eq(labOrders.id, order.id));

        return { patientId: order.patientId, branchId: order.branchId, computedParameters: computed };
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'LAB_RESULT_ENTERED',
      resourceType: 'lab_result',
      resourceId: resultId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { orderId: dto.orderId, patientId },
    });

    return { resultId, status: 'PENDING_AUTHORIZATION', parameters: computedParameters };
  }

  async authorizeResult(actor: AccessTokenClaims, resultId: string, meta: RequestMeta) {
    const authorizedAt = new Date();
    const signatureHash = await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: actor.branchId, actorId: actor.sub },
      async (tx) => {
        const [result] = await tx
          .select()
          .from(labResults)
          .where(and(eq(labResults.id, resultId), eq(labResults.organizationId, actor.orgId)))
          .limit(1);

        if (!result) throw new NotFoundException('Lab result not found.');
        if (result.status === 'AUTHORIZED') {
          throw new ConflictException('Lab result is already authorized.');
        }

        const sig = createHash('sha256')
          .update(`${result.id}|${result.resultPayloadEncrypted}|${actor.sub}|${authorizedAt.toISOString()}`)
          .digest('hex');

        await tx
          .update(labResults)
          .set({
            status: 'AUTHORIZED',
            authorizedByUserId: actor.sub,
            authorizedAt,
            digitalSignatureHash: sig,
          })
          .where(eq(labResults.id, resultId));

        await tx
          .update(labOrders)
          .set({ status: 'AUTHORIZED', updatedAt: authorizedAt })
          .where(eq(labOrders.id, result.orderId));

        return sig;
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: actor.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'LAB_RESULT_AUTHORIZED',
      resourceType: 'lab_result',
      resourceId: resultId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { digitalSignatureHash: signatureHash },
    });

    return { resultId, status: 'AUTHORIZED', digitalSignatureHash: signatureHash };
  }

  async getPatientLabResults(actor: AccessTokenClaims, patientId: string, meta: RequestMeta) {
    const rows = await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: actor.branchId, actorId: actor.sub },
      async (tx) => {
        if (actor.role === 'PATIENT') {
          const [pat] = await tx
            .select({ portalUserId: patients.portalUserId })
            .from(patients)
            .where(and(eq(patients.id, patientId), eq(patients.organizationId, actor.orgId)))
            .limit(1);
          if (!pat || pat.portalUserId !== actor.sub) {
            throw new ForbiddenException('Patients can only view their own lab results.');
          }
        }

        const conditions = [
          eq(labResults.organizationId, actor.orgId),
          eq(labResults.patientId, patientId),
        ];
        if (actor.role === 'PATIENT') {
          conditions.push(eq(labResults.status, 'AUTHORIZED'));
        }
        return tx
          .select()
          .from(labResults)
          .where(and(...conditions))
          .orderBy(desc(labResults.enteredAt))
          .limit(50);
      },
    );

    const decrypted = await Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        orderId: r.orderId,
        status: r.status,
        enteredAt: r.enteredAt,
        authorizedAt: r.authorizedAt,
        digitalSignatureHash: r.digitalSignatureHash,
        payload: await this.crypto.cipher.decryptJson<LabResultPayload>(r.resultPayloadEncrypted, {
          organizationId: actor.orgId,
          tableName: 'lab_results',
          recordId: r.id,
          fieldName: 'result_payload',
        }),
      })),
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: actor.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'PHI_LAB_RESULTS_READ',
      resourceType: 'patient',
      resourceId: patientId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { count: decrypted.length },
    });

    return decrypted;
  }

  async recordQc(actor: AccessTokenClaims, dto: RecordLabQcDto) {
    const qcId = randomUUID();
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(labQcRecords).values({
          id: qcId,
          organizationId: actor.orgId,
          branchId: dto.branchId,
          equipmentName: dto.equipmentName,
          controlLot: dto.controlLot,
          passed: dto.passed,
          notes: dto.notes ?? null,
          recordedByUserId: actor.sub,
        });
      },
    );
    return { qcId, passed: dto.passed };
  }

  async upsertReagent(actor: AccessTokenClaims, dto: UpsertLabReagentDto) {
    const reagentId = randomUUID();
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(labReagents).values({
          id: reagentId,
          organizationId: actor.orgId,
          branchId: dto.branchId,
          name: dto.name,
          lotNumber: dto.lotNumber,
          quantityRemaining: dto.quantityRemaining,
          reorderLevel: dto.reorderLevel,
          expiresAt: new Date(dto.expiresAt),
        });
      },
    );
    return { reagentId, lowStock: dto.quantityRemaining <= dto.reorderLevel };
  }

  async getLabPerformanceReport(actor: AccessTokenClaims, branchId?: string) {
    return withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: branchId ?? actor.branchId, actorId: actor.sub },
      async (tx) => {
        const conditions = [eq(labOrders.organizationId, actor.orgId)];
        if (branchId) conditions.push(eq(labOrders.branchId, branchId));

        return tx
          .select({
            status: labOrders.status,
            orderCount: count(labOrders.id),
          })
          .from(labOrders)
          .where(and(...conditions))
          .groupBy(labOrders.status);
      },
    );
  }
}
