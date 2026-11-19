import { Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import {
  GENESIS_AUDIT_HASH,
  computeAuditEntryHash,
  hashAuditPayload,
} from '@healthos/crypto';
import { auditLogs, withTenantContext } from '@healthos/db';
import { DbService } from '../security/security.module.js';
import { redactPhi } from '../common/phi-redactor.js';

export interface RecordAuditParams {
  organizationId: string;
  branchId?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(private readonly dbService: DbService) {}

  async record(params: RecordAuditParams): Promise<void> {
    const safeMetadata = redactPhi(params.metadata ?? {});
    const metadataHash = hashAuditPayload(safeMetadata);
    const occurredAt = new Date();
    const occurredAtIso = occurredAt.toISOString();

    await withTenantContext(
      this.dbService.db,
      {
        organizationId: params.organizationId,
        branchId: params.branchId ?? null,
        actorId: params.actorId ?? null,
      },
      async (tx) => {
        const [latest] = await tx
          .select({
            sequenceId: auditLogs.sequenceId,
            entryHash: auditLogs.entryHash,
          })
          .from(auditLogs)
          .where(eq(auditLogs.organizationId, params.organizationId))
          .orderBy(desc(auditLogs.sequenceId))
          .limit(1);

        const prevHash = latest?.entryHash ?? GENESIS_AUDIT_HASH;
        const nextSequence = latest ? latest.sequenceId + 1n : 1n;

        const entryHash = computeAuditEntryHash({
          sequenceId: nextSequence,
          prevHash,
          occurredAtIso,
          organizationId: params.organizationId,
          branchId: params.branchId ?? null,
          actorId: params.actorId ?? null,
          actorRole: params.actorRole ?? null,
          action: params.action,
          resourceType: params.resourceType,
          resourceId: params.resourceId ?? null,
          metadataHash,
        });

        await tx.insert(auditLogs).values({
          organizationId: params.organizationId,
          branchId: params.branchId ?? null,
          actorId: params.actorId ?? null,
          actorRole: params.actorRole ?? null,
          action: params.action,
          resourceType: params.resourceType,
          resourceId: params.resourceId ?? null,
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
          metadata: safeMetadata,
          metadataHash,
          prevHash,
          entryHash,
          occurredAt,
        });
      },
    );
  }
}
