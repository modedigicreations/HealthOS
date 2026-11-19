import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface GeneratedDataKey {
  keyId: string;
  plaintextKey: Buffer;
  encryptedKey: string;
}

export interface KmsProvider {
  readonly keyId: string;
  generateDataKey(): Promise<GeneratedDataKey>;
  decryptDataKey(encryptedKey: string): Promise<Buffer>;
}

/**
 * LocalKmsProvider wraps 256-bit Data Encryption Keys (DEKs) using a 256-bit
 * Key Encryption Key (KEK) via AES-256-GCM.
 *
 * Intended for local development, CI, and self-hosted clinic appliances where
 * the KEK is injected via a secure secret manager. In cloud deployments, swap
 * this implementation for AWS KMS / GCP Cloud KMS / HashiCorp Vault Transit.
 */
export class LocalKmsProvider implements KmsProvider {
  public readonly keyId: string;
  private readonly kek: Buffer;

  constructor(masterKeyHex: string, keyId = 'local-kek-v1') {
    if (!/^[0-9a-fA-F]{64}$/.test(masterKeyHex)) {
      throw new Error('LocalKmsProvider requires a 64-character hex (256-bit) master key.');
    }
    this.kek = Buffer.from(masterKeyHex, 'hex');
    this.keyId = keyId;
  }

  async generateDataKey(): Promise<GeneratedDataKey> {
    const plaintextKey = randomBytes(32);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.kek, iv);
    cipher.setAAD(Buffer.from(this.keyId, 'utf8'));

    const wrapped = Buffer.concat([cipher.update(plaintextKey), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const encryptedKey = [
      'kekv1',
      this.keyId,
      iv.toString('base64url'),
      authTag.toString('base64url'),
      wrapped.toString('base64url'),
    ].join(':');

    return {
      keyId: this.keyId,
      plaintextKey,
      encryptedKey,
    };
  }

  async decryptDataKey(encryptedKey: string): Promise<Buffer> {
    const parts = encryptedKey.split(':');
    if (parts.length !== 5 || parts[0] !== 'kekv1') {
      throw new Error('Malformed wrapped data key envelope.');
    }

    const [, keyId, ivB64, tagB64, wrappedB64] = parts;
    if (!keyId || !ivB64 || !tagB64 || !wrappedB64) {
      throw new Error('Incomplete wrapped data key envelope.');
    }
    if (keyId !== this.keyId) {
      throw new Error(`Key ID mismatch: expected ${this.keyId}, got ${keyId}`);
    }

    const iv = Buffer.from(ivB64, 'base64url');
    const authTag = Buffer.from(tagB64, 'base64url');
    const wrapped = Buffer.from(wrappedB64, 'base64url');

    const decipher = createDecipheriv('aes-256-gcm', this.kek, iv);
    decipher.setAAD(Buffer.from(keyId, 'utf8'));
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(wrapped), decipher.final()]);
  }
}
