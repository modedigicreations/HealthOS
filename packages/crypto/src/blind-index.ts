import { createHmac } from 'node:crypto';

/**
 * BlindIndex computes deterministic keyed HMAC-SHA256 digests so encrypted
 * identifiers (email, phone, national ID, patient number) can be indexed and
 * queried for exact matches without storing plaintext.
 */
export class BlindIndex {
  private readonly key: Buffer;

  constructor(blindIndexKeyHex: string) {
    if (!/^[0-9a-fA-F]{64}$/.test(blindIndexKeyHex)) {
      throw new Error('BlindIndex requires a 64-character hex (256-bit) key.');
    }
    this.key = Buffer.from(blindIndexKeyHex, 'hex');
  }

  compute(value: string, scope: { organizationId: string; field: string }): string {
    const normalized = value.trim().toLowerCase();
    const hmac = createHmac('sha256', this.key);
    hmac.update(`${scope.organizationId}|${scope.field}|${normalized}`);
    return hmac.digest('hex');
  }
}
