import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify<string | Buffer, string | Buffer, number, ScryptOptions, Buffer>(
  scrypt as unknown as (
    password: string | Buffer,
    salt: string | Buffer,
    keylen: number,
    options: ScryptOptions,
    callback: (err: Error | null, derivedKey: Buffer) => void,
  ) => void,
);

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

/**
 * Password hashing using Node's native scrypt with per-password random 16-byte
 * salts and constant-time verification.
 */
export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12) {
    throw new Error('Password must be at least 12 characters long.');
  }
  const salt = randomBytes(16).toString('base64url');
  const derived = await scryptAsync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$N=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P}$${salt}$${derived.toString('base64url')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, paramStr, salt, expectedB64] = parts;
  if (!paramStr || !salt || !expectedB64) {
    return false;
  }

  const params = Object.fromEntries(
    paramStr.split(',').map((kv) => {
      const [k, v] = kv.split('=');
      return [k, Number(v)];
    }),
  );
  const N = Number.isFinite(params.N) ? params.N : SCRYPT_N;
  const r = Number.isFinite(params.r) ? params.r : SCRYPT_R;
  const p = Number.isFinite(params.p) ? params.p : SCRYPT_P;

  const expected = Buffer.from(expectedB64, 'base64url');
  const derived = await scryptAsync(password, salt, expected.length, { N, r, p });
  if (derived.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(derived, expected);
}
