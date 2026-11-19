import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, lte } from 'drizzle-orm';
import { GENESIS_AUDIT_HASH, computeAuditEntryHash, hashAuditPayload } from '@healthos/crypto';
import type {
  CreateCapaDto,
  CreateComplianceChecklistDto,
  CreateSopDto,
  RecordFacilityLicenceDto,
  ReportIncidentDto,
  UpdateCapaStatusDto,
} from '@healthos/contracts';
import {
  auditLogs,
  capaActions,
  complianceChecklists,
  facilityLicences,
  incidentReports,
  sopDocuments,
  withTenantContext,
} from '@healthos/db';
import { AuditService } from '../audit/audit.service.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { CryptoService, DbService, type AccessTokenClaims } from '../security/security.module.js';

@Injectable()
export class ComplianceService {
  constructor(
    private readonly dbService: DbService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  async createChecklist(actor: AccessTokenClaims, dto: CreateComplianceChecklistDto) {
    const checklistId = randomUUID();
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(complianceChecklists).values({
          id: checklistId,
          organizationId: actor.orgId,
          branchId: dto.branchId,
          jurisdiction: dto.jurisdiction.toUpperCase(),
          category: dto.category,
          title: dto.title,
          items: dto.items,
          createdByUserId: actor.sub,
        });
      },
    );
    return { checklistId, jurisdiction: dto.jurisdiction.toUpperCase() };
  }

  async recordFacilityLicence(
    actor: AccessTokenClaims,
    dto: RecordFacilityLicenceDto,
    meta: RequestMeta,
  ) {
    const licenceId = randomUUID();
    const licenceNumberEncrypted = await this.crypto.cipher.encryptString(dto.licenceNumber, {
      organizationId: actor.orgId,
      tableName: 'facility_licences',
      recordId: licenceId,
      fieldName: 'licence_number',
    });

    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(facilityLicences).values({
          id: licenceId,
          organizationId: actor.orgId,
          branchId: dto.branchId,
          licenceName: dto.licenceName,
          authority: dto.authority,
          licenceNumberEncrypted,
          issuedAt: new Date(dto.issuedAt),
          expiresAt: new Date(dto.expiresAt),
        });
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: dto.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'COMPLIANCE_LICENCE_RECORDED',
      resourceType: 'facility_licence',
      resourceId: licenceId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { licenceName: dto.licenceName, authority: dto.authority },
    });

    return { licenceId };
  }

  async getExpiringFacilityLicences(actor: AccessTokenClaims, withinDays = 60) {
    const cutoff = new Date(Date.now() + withinDays * 86_400_000);
    return withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        return tx
          .select({
            id: facilityLicences.id,
            branchId: facilityLicences.branchId,
            licenceName: facilityLicences.licenceName,
            authority: facilityLicences.authority,
            expiresAt: facilityLicences.expiresAt,
          })
          .from(facilityLicences)
          .where(
            and(
              eq(facilityLicences.organizationId, actor.orgId),
              lte(facilityLicences.expiresAt, cutoff),
            ),
          );
      },
    );
  }

  async publishSop(actor: AccessTokenClaims, dto: CreateSopDto) {
    const sopId = randomUUID();
    const storageKeyEncrypted = await this.crypto.cipher.encryptString(dto.storageKey, {
      organizationId: actor.orgId,
      tableName: 'sop_documents',
      recordId: sopId,
      fieldName: 'storage_key',
    });

    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(sopDocuments).values({
          id: sopId,
          organizationId: actor.orgId,
          department: dto.department,
          title: dto.title,
          version: dto.version,
          contentChecksum: dto.contentChecksum,
          storageKeyEncrypted,
          publishedByUserId: actor.sub,
        });
      },
    );
    return { sopId, version: dto.version };
  }

  async reportIncident(actor: AccessTokenClaims, dto: ReportIncidentDto, meta: RequestMeta) {
    const incidentId = randomUUID();
    const descriptionEncrypted = await this.crypto.cipher.encryptString(dto.description, {
      organizationId: actor.orgId,
      tableName: 'incident_reports',
      recordId: incidentId,
      fieldName: 'description',
    });

    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(incidentReports).values({
          id: incidentId,
          organizationId: actor.orgId,
          branchId: dto.branchId,
          category: dto.category,
          severity: dto.severity,
          descriptionEncrypted,
          reportedByUserId: actor.sub,
        });
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: dto.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'INCIDENT_REPORTED',
      resourceType: 'incident_report',
      resourceId: incidentId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { category: dto.category, severity: dto.severity },
    });

    return { incidentId, status: 'OPEN' };
  }

  async createCapa(actor: AccessTokenClaims, dto: CreateCapaDto) {
    const capaId = randomUUID();
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(capaActions).values({
          id: capaId,
          organizationId: actor.orgId,
          branchId: dto.branchId,
          incidentId: dto.incidentId ?? null,
          title: dto.title,
          actionPlan: dto.actionPlan,
          assignedToUserId: dto.assignedToUserId,
          dueAt: new Date(dto.dueAt),
        });
      },
    );
    return { capaId, status: 'OPEN' };
  }

  async updateCapaStatus(
    actor: AccessTokenClaims,
    capaId: string,
    dto: UpdateCapaStatusDto,
    meta: RequestMeta,
  ) {
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        await tx
          .update(capaActions)
          .set({ status: dto.status })
          .where(and(eq(capaActions.id, capaId), eq(capaActions.organizationId, actor.orgId)));
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: actor.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'CAPA_STATUS_UPDATED',
      resourceType: 'capa_action',
      resourceId: capaId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { status: dto.status },
    });

    return { capaId, status: dto.status };
  }

  /**
   * Verifies the cryptographic SHA-256 hash chain of the organization's audit_logs.
   */
  async verifyAuditChain(actor: AccessTokenClaims) {
    return withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        const entries = await tx
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.organizationId, actor.orgId))
          .orderBy(asc(auditLogs.sequenceId));

        let expectedPrev = GENESIS_AUDIT_HASH;
        let expectedSeq = 1n;

        for (const entry of entries) {
          if (entry.prevHash !== expectedPrev) {
            return {
              valid: false,
              checkedCount: Number(entry.sequenceId),
              brokenAtSequenceId: String(entry.sequenceId),
              reason: 'prev_hash mismatch',
            };
          }
          const recomputedPayloadHash = hashAuditPayload(entry.metadata);
          const recomputed = computeAuditEntryHash({
            sequenceId: expectedSeq,
            prevHash: expectedPrev,
            occurredAtIso: entry.occurredAt.toISOString(),
            organizationId: entry.organizationId,
            branchId: entry.branchId,
            actorId: entry.actorId,
            actorRole: entry.actorRole,
            action: entry.action,
            resourceType: entry.resourceType,
            resourceId: entry.resourceId,
            metadataHash: recomputedPayloadHash,
          });
          if (recomputed !== entry.entryHash) {
            return {
              valid: false,
              checkedCount: Number(entry.sequenceId),
              brokenAtSequenceId: String(entry.sequenceId),
              reason: 'entry_hash mismatch',
            };
          }
          expectedPrev = entry.entryHash;
          expectedSeq += 1n;
        }

        return { valid: true, checkedCount: entries.length };
      },
    );
  }
}
