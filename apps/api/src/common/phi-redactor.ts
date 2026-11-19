const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'mfasecret',
  'authorization',
  'cookie',
  'email',
  'phone',
  'nationalid',
  'ssn',
  'diagnosis',
  'notes',
  'clinicalnotes',
  'medicalhistory',
  'prescription',
]);

export function redactPhi<T>(input: T, depth = 0): T {
  if (depth > 8 || input === null || input === undefined) {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((item) => redactPhi(item, depth + 1)) as unknown as T;
  }
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      const normalized = k.toLowerCase().replace(/[_-]/g, '');
      if (
        SENSITIVE_KEYS.has(normalized) ||
        normalized.endsWith('encrypted') ||
        normalized.endsWith('secret')
      ) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactPhi(v, depth + 1);
      }
    }
    return out as T;
  }
  return input;
}
