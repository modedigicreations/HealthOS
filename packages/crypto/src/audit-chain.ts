import { createHash } from 'node:crypto';

export interface AuditChainInput {
  sequenceId: bigint | number | string;
  prevHash: string;
  occurredAtIso: string;
  organizationId: string;
  branchId: string | null;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadataHash: string;
}

export const GENESIS_AUDIT_HASH = '0'.repeat(64);

export function hashAuditPayload(payload: unknown): string {
  const serialized = JSON.stringify(payload ?? {});
  return createHash('sha256').update(serialized, 'utf8').digest('hex');
}

/**
 * Computes a deterministic SHA-256 link in the append-only audit log chain.
 * Any modification or deletion of historical audit entries breaks verification.
 */
export function computeAuditEntryHash(input: AuditChainInput): string {
  const canonical = [
    String(input.sequenceId),
    input.prevHash,
    input.occurredAtIso,
    input.organizationId,
    input.branchId ?? '',
    input.actorId ?? '',
    input.actorRole ?? '',
    input.action,
    input.resourceType,
    input.resourceId ?? '',
    input.metadataHash,
  ].join('|');

  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
