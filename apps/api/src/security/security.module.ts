import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { SignJWT, jwtVerify } from 'jose';
import { BlindIndex, EnvelopeCipher, LocalKmsProvider } from '@healthos/crypto';
import { createDb, createDbPool, type HealthOsDb } from '@healthos/db';
import type { UserRole } from '@healthos/contracts';
import { loadEnv, type AppEnv } from '../common/env.js';
import type { Pool } from 'pg';

export interface AccessTokenClaims {
  sub: string;
  orgId: string;
  branchId: string | null;
  role: UserRole;
  mfaVerified: boolean;
}

@Injectable()
export class CryptoService {
  public readonly kms: LocalKmsProvider;
  public readonly cipher: EnvelopeCipher;
  public readonly blindIndex: BlindIndex;

  constructor(env: AppEnv) {
    this.kms = new LocalKmsProvider(env.localMasterKeyHex);
    this.cipher = new EnvelopeCipher(this.kms);
    this.blindIndex = new BlindIndex(env.blindIndexKeyHex);
  }
}

@Injectable()
export class TokenService {
  private readonly accessKey: Uint8Array;
  private readonly accessTtlSeconds: number;

  constructor(env: AppEnv) {
    this.accessKey = new TextEncoder().encode(env.jwtAccessSecret);
    this.accessTtlSeconds = env.jwtAccessTtlSeconds;
  }

  async signAccessToken(claims: AccessTokenClaims): Promise<string> {
    return new SignJWT({
      orgId: claims.orgId,
      branchId: claims.branchId,
      role: claims.role,
      mfaVerified: claims.mfaVerified,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(claims.sub)
      .setIssuedAt()
      .setExpirationTime(`${this.accessTtlSeconds}s`)
      .sign(this.accessKey);
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    const { payload } = await jwtVerify(token, this.accessKey);
    if (!payload.sub || !payload.orgId || !payload.role) {
      throw new Error('Invalid access token claims.');
    }
    return {
      sub: String(payload.sub),
      orgId: String(payload.orgId),
      branchId: payload.branchId ? String(payload.branchId) : null,
      role: payload.role as UserRole,
      mfaVerified: Boolean(payload.mfaVerified),
    };
  }
}

@Injectable()
export class DbService implements OnModuleDestroy {
  public readonly pool: Pool;
  public readonly db: HealthOsDb;

  constructor(env: AppEnv) {
    this.pool = createDbPool(env.databaseUrl);
    this.db = createDb(this.pool);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: 'APP_ENV',
      useFactory: () => loadEnv(),
    },
    {
      provide: CryptoService,
      inject: ['APP_ENV'],
      useFactory: (env: AppEnv) => new CryptoService(env),
    },
    {
      provide: TokenService,
      inject: ['APP_ENV'],
      useFactory: (env: AppEnv) => new TokenService(env),
    },
    {
      provide: DbService,
      inject: ['APP_ENV'],
      useFactory: (env: AppEnv) => new DbService(env),
    },
  ],
  exports: ['APP_ENV', CryptoService, TokenService, DbService],
})
export class SecurityModule {}
