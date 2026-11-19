import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(encoded: string): Buffer {
  const clean = encoded.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) {
      throw new Error('Invalid Base32 character in TOTP secret.');
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

export function buildTotpUri(params: {
  secret: string;
  accountName: string;
  issuer?: string;
}): string {
  const issuer = encodeURIComponent(params.issuer ?? 'HealthOS');
  const account = encodeURIComponent(params.accountName);
  return `otpauth://totp/${issuer}:${account}?secret=${params.secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

export function generateTotpCode(secret: string, timestampMs = Date.now(), stepSeconds = 30): string {
  const key = base32Decode(secret);
  const counter = Math.floor(timestampMs / 1000 / stepSeconds);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac('sha1', key).update(counterBuf).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary =
    (((digest[offset] ?? 0) & 0x7f) << 24) |
    (((digest[offset + 1] ?? 0) & 0xff) << 16) |
    (((digest[offset + 2] ?? 0) & 0xff) << 8) |
    ((digest[offset + 3] ?? 0) & 0xff);

  return String(binary % 1_000_000).padStart(6, '0');
}

export function verifyTotpCode(
  secret: string,
  code: string,
  timestampMs = Date.now(),
  windowSteps = 1,
): boolean {
  if (!/^\d{6}$/.test(code)) {
    return false;
  }
  const codeBuf = Buffer.from(code, 'utf8');
  for (let delta = -windowSteps; delta <= windowSteps; delta++) {
    const candidate = generateTotpCode(secret, timestampMs + delta * 30_000);
    const candidateBuf = Buffer.from(candidate, 'utf8');
    if (timingSafeEqual(codeBuf, candidateBuf)) {
      return true;
    }
  }
  return false;
}
