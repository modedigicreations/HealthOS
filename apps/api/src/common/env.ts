export interface AppEnv {
  nodeEnv: string;
  port: number;
  corsOrigin: string;
  databaseUrl: string;
  localMasterKeyHex: string;
  blindIndexKeyHex: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessTtlSeconds: number;
  jwtRefreshTtlSeconds: number;
}

export function loadEnv(): AppEnv {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const jwtAccessSecret =
    process.env.JWT_ACCESS_SECRET ??
    'dev-only-access-secret-do-not-use-in-production-healthos-min-64-chars';
  const jwtRefreshSecret =
    process.env.JWT_REFRESH_SECRET ??
    'dev-only-refresh-secret-do-not-use-in-production-healthos-min-64-chars';

  if (nodeEnv === 'production') {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required in production.');
    if (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET.length < 32) {
      throw new Error('Strong JWT_ACCESS_SECRET is required in production.');
    }
    if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 32) {
      throw new Error('Strong JWT_REFRESH_SECRET is required in production.');
    }
  }

  return {
    nodeEnv,
    port: Number(process.env.API_PORT ?? 4000),
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    databaseUrl:
      process.env.DATABASE_URL ??
      'postgresql://healthos:healthos_dev_password@localhost:5432/healthos',
    localMasterKeyHex:
      process.env.LOCAL_MASTER_KEY_HEX ??
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    blindIndexKeyHex:
      process.env.BLIND_INDEX_KEY_HEX ??
      'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
    jwtAccessSecret,
    jwtRefreshSecret,
    jwtAccessTtlSeconds: Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900),
    jwtRefreshTtlSeconds: Number(process.env.JWT_REFRESH_TTL_SECONDS ?? 604800),
  };
}
