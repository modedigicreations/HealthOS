import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { SignJWT, jwtVerify } from 'jose';
import {
  buildTotpUri,
  generateTotpSecret,
  hashPassword,
  verifyPassword,
  verifyTotpCode,
} from '@healthos/crypto';
import type {
  BootstrapOrgDto,
  CreateStaffUserDto,
  LoginDto,
  MfaVerifyDto,
  UserRole,
} from '@healthos/contracts';
import {
  branches,
  organizations,
  refreshTokens,
  userBranchAccess,
  users,
  withTenantContext,
} from '@healthos/db';
import type { AppEnv } from '../common/env.js';
import { AuditService } from '../audit/audit.service.js';
import {
  CryptoService,
  DbService,
  TokenService,
  type AccessTokenClaims,
} from '../security/security.module.js';

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

export interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuthService {
  private readonly mfaChallengeKey: Uint8Array;

  constructor(
    @Inject('APP_ENV') private readonly env: AppEnv,
    private readonly dbService: DbService,
    private readonly crypto: CryptoService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {
    this.mfaChallengeKey = new TextEncoder().encode(`${env.jwtAccessSecret}:mfa-challenge`);
  }

  /**
   * Bootstraps the first Healthcare Organization, primary Branch, and SUPER_ADMIN user.
   */
  async bootstrapOrganization(dto: BootstrapOrgDto, meta: RequestMeta) {
    const existing = await this.dbService.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, dto.organizationSlug))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('Organization slug already exists.');
    }

    const orgId = randomUUID();
    const branchId = randomUUID();
    const userId = randomUUID();
    const passwordHash = await hashPassword(dto.adminPassword);

    const emailEncrypted = await this.crypto.cipher.encryptString(dto.adminEmail, {
      organizationId: orgId,
      tableName: 'users',
      recordId: userId,
      fieldName: 'email',
    });
    const fullNameEncrypted = await this.crypto.cipher.encryptString(dto.adminFullName, {
      organizationId: orgId,
      tableName: 'users',
      recordId: userId,
      fieldName: 'full_name',
    });
    const emailBlindIndex = this.crypto.blindIndex.compute(dto.adminEmail, {
      organizationId: orgId,
      field: 'email',
    });

    await this.dbService.db.insert(organizations).values({
      id: orgId,
      name: dto.organizationName,
      slug: dto.organizationSlug,
      jurisdiction: dto.jurisdiction,
    });

    await withTenantContext(this.dbService.db, { organizationId: orgId, branchId, actorId: userId }, async (tx) => {
      await tx.insert(branches).values({
        id: branchId,
        organizationId: orgId,
        name: dto.branchName,
        code: dto.branchCode.toUpperCase(),
        facilityType: 'HOSPITAL',
      });

      await tx.insert(users).values({
        id: userId,
        organizationId: orgId,
        emailEncrypted,
        emailBlindIndex,
        fullNameEncrypted,
        role: 'SUPER_ADMIN',
        passwordHash,
      });

      await tx.insert(userBranchAccess).values({
        organizationId: orgId,
        userId,
        branchId,
        department: 'ADMINISTRATION',
        isDefault: true,
      });
    });

    await this.audit.record({
      organizationId: orgId,
      branchId,
      actorId: userId,
      actorRole: 'SUPER_ADMIN',
      action: 'ORG_BOOTSTRAP',
      resourceType: 'organization',
      resourceId: orgId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { slug: dto.organizationSlug, branchCode: dto.branchCode },
    });

    return { organizationId: orgId, branchId, superAdminUserId: userId };
  }

  async createStaffUser(actor: AccessTokenClaims, dto: CreateStaffUserDto, meta: RequestMeta) {
    const userId = randomUUID();
    const passwordHash = await hashPassword(dto.password);
    const emailBlindIndex = this.crypto.blindIndex.compute(dto.email, {
      organizationId: actor.orgId,
      field: 'email',
    });

    const emailEncrypted = await this.crypto.cipher.encryptString(dto.email, {
      organizationId: actor.orgId,
      tableName: 'users',
      recordId: userId,
      fieldName: 'email',
    });
    const fullNameEncrypted = await this.crypto.cipher.encryptString(dto.fullName, {
      organizationId: actor.orgId,
      tableName: 'users',
      recordId: userId,
      fieldName: 'full_name',
    });

    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        const dup = await tx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.organizationId, actor.orgId), eq(users.emailBlindIndex, emailBlindIndex)))
          .limit(1);

        if (dup.length > 0) {
          throw new ConflictException('A user with this email already exists in the organization.');
        }

        await tx.insert(users).values({
          id: userId,
          organizationId: actor.orgId,
          emailEncrypted,
          emailBlindIndex,
          fullNameEncrypted,
          role: dto.role,
          passwordHash,
        });

        await tx.insert(userBranchAccess).values({
          organizationId: actor.orgId,
          userId,
          branchId: dto.branchId,
          department: dto.department ?? null,
          isDefault: true,
        });
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: dto.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'STAFF_USER_CREATED',
      resourceType: 'user',
      resourceId: userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { role: dto.role, department: dto.department ?? null },
    });

    return { userId, role: dto.role, branchId: dto.branchId };
  }

  async login(dto: LoginDto, meta: RequestMeta) {
    const [org] = await this.dbService.db
      .select()
      .from(organizations)
      .where(and(eq(organizations.slug, dto.organizationSlug), eq(organizations.isActive, true)))
      .limit(1);

    if (!org) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const emailBlind = this.crypto.blindIndex.compute(dto.email, {
      organizationId: org.id,
      field: 'email',
    });

    return withTenantContext(this.dbService.db, { organizationId: org.id }, async (tx) => {
      const [user] = await tx
        .select()
        .from(users)
        .where(and(eq(users.organizationId, org.id), eq(users.emailBlindIndex, emailBlind)))
        .limit(1);

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid credentials.');
      }

      if (user.lockedUntil && user.lockedUntil > new Date()) {
        throw new ForbiddenException('Account temporarily locked due to repeated failed logins.');
      }

      const validPassword = await verifyPassword(dto.password, user.passwordHash);
      if (!validPassword) {
        const attempts = user.failedLoginAttempts + 1;
        const lockedUntil =
          attempts >= MAX_FAILED_LOGINS
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
            : null;

        await tx
          .update(users)
          .set({ failedLoginAttempts: attempts, lockedUntil })
          .where(eq(users.id, user.id));

        await this.audit.record({
          organizationId: org.id,
          actorId: user.id,
          actorRole: user.role,
          action: 'AUTH_LOGIN_FAILED',
          resourceType: 'user',
          resourceId: user.id,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          metadata: { attempts, locked: Boolean(lockedUntil) },
        });

        throw new UnauthorizedException('Invalid credentials.');
      }

      await tx
        .update(users)
        .set({ failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() })
        .where(eq(users.id, user.id));

      const [defaultBranch] = await tx
        .select({ branchId: userBranchAccess.branchId })
        .from(userBranchAccess)
        .where(eq(userBranchAccess.userId, user.id))
        .limit(1);

      const branchId = defaultBranch?.branchId ?? null;

      if (user.mfaEnabled) {
        const mfaChallengeToken = await new SignJWT({
          orgId: org.id,
          branchId,
          role: user.role,
          purpose: 'mfa_challenge',
        })
          .setProtectedHeader({ alg: 'HS256' })
          .setSubject(user.id)
          .setIssuedAt()
          .setExpirationTime('5m')
          .sign(this.mfaChallengeKey);

        return { mfaRequired: true as const, mfaChallengeToken };
      }

      return this.issueSessionTokens(
        {
          sub: user.id,
          orgId: org.id,
          branchId,
          role: user.role as UserRole,
          mfaVerified: false,
        },
        meta,
      );
    });
  }

  async setupMfa(actor: AccessTokenClaims) {
    const secret = generateTotpSecret();
    const secretEncrypted = await this.crypto.cipher.encryptString(secret, {
      organizationId: actor.orgId,
      tableName: 'users',
      recordId: actor.sub,
      fieldName: 'mfa_secret',
    });

    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        await tx
          .update(users)
          .set({ mfaSecretEncrypted: secretEncrypted, mfaEnabled: false })
          .where(eq(users.id, actor.sub));
      },
    );

    const otpauthUri = buildTotpUri({ secret, accountName: actor.sub, issuer: 'HealthOS' });
    return { otpauthUri, secret };
  }

  async enableMfa(actor: AccessTokenClaims, code: string, meta: RequestMeta) {
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        const [user] = await tx.select().from(users).where(eq(users.id, actor.sub)).limit(1);
        if (!user?.mfaSecretEncrypted) {
          throw new BadRequestException('MFA setup has not been initiated.');
        }

        const secret = await this.crypto.cipher.decryptString(user.mfaSecretEncrypted, {
          organizationId: actor.orgId,
          tableName: 'users',
          recordId: actor.sub,
          fieldName: 'mfa_secret',
        });

        if (!verifyTotpCode(secret, code)) {
          throw new UnauthorizedException('Invalid TOTP verification code.');
        }

        await tx.update(users).set({ mfaEnabled: true }).where(eq(users.id, actor.sub));
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: actor.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'AUTH_MFA_ENABLED',
      resourceType: 'user',
      resourceId: actor.sub,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { mfaEnabled: true };
  }

  async verifyMfaChallenge(dto: MfaVerifyDto, meta: RequestMeta) {
    let payload: { sub?: string; orgId?: string; branchId?: string | null; role?: UserRole; purpose?: string };
    try {
      const verified = await jwtVerify(dto.mfaChallengeToken, this.mfaChallengeKey);
      payload = verified.payload as typeof payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired MFA challenge.');
    }

    if (payload.purpose !== 'mfa_challenge' || !payload.sub || !payload.orgId || !payload.role) {
      throw new UnauthorizedException('Invalid MFA challenge claims.');
    }

    const orgId = payload.orgId;
    const userId = payload.sub;

    await withTenantContext(this.dbService.db, { organizationId: orgId, actorId: userId }, async (tx) => {
      const [user] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user?.mfaEnabled || !user.mfaSecretEncrypted) {
        throw new UnauthorizedException('MFA is not configured.');
      }

      const secret = await this.crypto.cipher.decryptString(user.mfaSecretEncrypted, {
        organizationId: orgId,
        tableName: 'users',
        recordId: userId,
        fieldName: 'mfa_secret',
      });

      if (!verifyTotpCode(secret, dto.code)) {
        throw new UnauthorizedException('Invalid TOTP code.');
      }
    });

    return this.issueSessionTokens(
      {
        sub: userId,
        orgId,
        branchId: payload.branchId ?? null,
        role: payload.role,
        mfaVerified: true,
      },
      meta,
    );
  }

  async refreshSession(rawRefreshToken: string, meta: RequestMeta) {
    const tokenHash = createHash('sha256').update(rawRefreshToken).digest('hex');

    const [record] = await this.dbService.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);

    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    return withTenantContext(
      this.dbService.db,
      { organizationId: record.organizationId, actorId: record.userId },
      async (tx) => {
        await tx
          .update(refreshTokens)
          .set({ revokedAt: new Date() })
          .where(and(eq(refreshTokens.id, record.id), isNull(refreshTokens.revokedAt)));

        const [user] = await tx.select().from(users).where(eq(users.id, record.userId)).limit(1);
        if (!user || !user.isActive) {
          throw new UnauthorizedException('User account is inactive.');
        }

        const [defaultBranch] = await tx
          .select({ branchId: userBranchAccess.branchId })
          .from(userBranchAccess)
          .where(eq(userBranchAccess.userId, user.id))
          .limit(1);

        return this.issueSessionTokens(
          {
            sub: user.id,
            orgId: record.organizationId,
            branchId: defaultBranch?.branchId ?? null,
            role: user.role as UserRole,
            mfaVerified: user.mfaEnabled,
          },
          meta,
        );
      },
    );
  }

  async logout(actor: AccessTokenClaims, rawRefreshToken: string | undefined, meta: RequestMeta) {
    if (rawRefreshToken) {
      const tokenHash = createHash('sha256').update(rawRefreshToken).digest('hex');
      await withTenantContext(
        this.dbService.db,
        { organizationId: actor.orgId, actorId: actor.sub },
        async (tx) => {
          await tx
            .update(refreshTokens)
            .set({ revokedAt: new Date() })
            .where(eq(refreshTokens.tokenHash, tokenHash));
        },
      );
    }

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: actor.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'AUTH_LOGOUT',
      resourceType: 'session',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  private async issueSessionTokens(claims: AccessTokenClaims, meta: RequestMeta) {
    const accessToken = await this.tokens.signAccessToken(claims);
    const rawRefreshToken = randomBytes(48).toString('base64url');
    const tokenHash = createHash('sha256').update(rawRefreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + this.env.jwtRefreshTtlSeconds * 1000);

    await withTenantContext(
      this.dbService.db,
      { organizationId: claims.orgId, branchId: claims.branchId, actorId: claims.sub },
      async (tx) => {
        await tx.insert(refreshTokens).values({
          organizationId: claims.orgId,
          userId: claims.sub,
          tokenHash,
          ipAddress: meta.ipAddress ?? null,
          userAgent: meta.userAgent ?? null,
          expiresAt,
        });
      },
    );

    await this.audit.record({
      organizationId: claims.orgId,
      branchId: claims.branchId,
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'AUTH_LOGIN_SUCCESS',
      resourceType: 'session',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { mfaVerified: claims.mfaVerified },
    });

    return {
      mfaRequired: false as const,
      accessToken,
      refreshToken: rawRefreshToken,
      expiresInSeconds: this.env.jwtAccessTtlSeconds,
    };
  }
}
