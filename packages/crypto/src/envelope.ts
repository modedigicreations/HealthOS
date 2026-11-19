import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { KmsProvider } from './kms.js';

/**
 * Context bound into AES-256-GCM Additional Authenticated Data (AAD).
 * Prevents ciphertext transplantation across tenants, tables, records, or fields.
 */
export interface EncryptionContext {
  organizationId: string;
  tableName: string;
  recordId: string;
  fieldName: string;
}

function serializeAad(ctx: EncryptionContext): Buffer {
  const canonical = `${ctx.organizationId}|${ctx.tableName}|${ctx.recordId}|${ctx.fieldName}`;
  return Buffer.from(canonical, 'utf8');
}

/**
 * EnvelopeCipher implements per-value AES-256-GCM envelope encryption backed
 * by a KmsProvider. Even with full SQL read access, database administrators
 * cannot read PHI without KMS access and the exact record context.
 */
export class EnvelopeCipher {
  constructor(private readonly kms: KmsProvider) {}

  async encryptString(plaintext: string, context: EncryptionContext): Promise<string> {
    const { keyId, plaintextKey, encryptedKey } = await this.kms.generateDataKey();
    try {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', plaintextKey, iv);
      cipher.setAAD(serializeAad(context));

      const ciphertext = Buffer.concat([
        cipher.update(Buffer.from(plaintext, 'utf8')),
        cipher.final(),
      ]);
      const authTag = cipher.getAuthTag();

      return [
        'env1',
        keyId,
        encryptedKey,
        iv.toString('base64url'),
        authTag.toString('base64url'),
        ciphertext.toString('base64url'),
      ].join('.');
    } finally {
      plaintextKey.fill(0);
    }
  }

  async decryptString(envelope: string, context: EncryptionContext): Promise<string> {
    const parts = envelope.split('.');
    if (parts.length !== 6 || parts[0] !== 'env1') {
      throw new Error('Invalid encrypted envelope format.');
    }

    const [, , encryptedKey, ivB64, tagB64, cipherB64] = parts;
    if (!encryptedKey || !ivB64 || !tagB64 || !cipherB64) {
      throw new Error('Incomplete encrypted envelope.');
    }

    const dek = await this.kms.decryptDataKey(encryptedKey);
    try {
      const iv = Buffer.from(ivB64, 'base64url');
      const authTag = Buffer.from(tagB64, 'base64url');
      const ciphertext = Buffer.from(cipherB64, 'base64url');

      const decipher = createDecipheriv('aes-256-gcm', dek, iv);
      decipher.setAAD(serializeAad(context));
      decipher.setAuthTag(authTag);

      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return plaintext.toString('utf8');
    } finally {
      dek.fill(0);
    }
  }

  async encryptJson<T>(value: T, context: EncryptionContext): Promise<string> {
    return this.encryptString(JSON.stringify(value), context);
  }

  async decryptJson<T>(envelope: string, context: EncryptionContext): Promise<T> {
    const raw = await this.decryptString(envelope, context);
    return JSON.parse(raw) as T;
  }
}
