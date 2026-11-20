import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';
import { generateTotpCode } from '@healthos/crypto';
import { patients } from '@healthos/db';
import { loadEnv } from '../common/env.js';
import { CryptoService, DbService, TokenService } from './security.module.js';
import { AuditService } from '../audit/audit.service.js';
import { AuthService } from '../auth/auth.service.js';
import { PatientsService } from '../patients/patients.service.js';
import { ComplianceService } from '../compliance/compliance.service.js';

const E2E_DB_URL = process.env.HEALTHOS_E2E_DB_URL;

describe('HealthOS Phase 0 & Module 1 PostgreSQL Security E2E', { skip: !E2E_DB_URL }, () => {
  let dbService: DbService;
  let auth: AuthService;
  let patientsSvc: PatientsService;
  let compliance: ComplianceService;
  let tokens: TokenService;

  before(() => {
    process.env.DATABASE_URL = E2E_DB_URL;
    const env = loadEnv();
    dbService = new DbService(env);
    const crypto = new CryptoService(env);
    tokens = new TokenService(env);
    const audit = new AuditService(dbService);
    auth = new AuthService(env, dbService, crypto, tokens, audit);
    patientsSvc = new PatientsService(dbService, crypto, audit);
    compliance = new ComplianceService(dbService, crypto, audit);
  });

  after(async () => {
    await dbService.onModuleDestroy();
  });

  it('enforces RLS, MFA, refresh rotation, encrypted EMR, immutable audit logs, and SHA-256 chain verification', async () => {
    const slugA = `hosp-a-${Date.now()}`;
    const slugB = `hosp-b-${Date.now()}`;

    const orgA = await auth.bootstrapOrganization(
      {
        organizationName: 'Hospital A',
        organizationSlug: slugA,
        jurisdiction: 'NG',
        branchName: 'Main',
        branchCode: 'MAIN',
        adminEmail: 'admin@hospa.org',
        adminFullName: 'Admin A',
        adminPassword: 'CorrectHorseBatteryStaple!99',
      },
      { ipAddress: '127.0.0.1' },
    );

    const orgB = await auth.bootstrapOrganization(
      {
        organizationName: 'Hospital B',
        organizationSlug: slugB,
        jurisdiction: 'NG',
        branchName: 'Main',
        branchCode: 'MAIN',
        adminEmail: 'admin@hospb.org',
        adminFullName: 'Admin B',
        adminPassword: 'CorrectHorseBatteryStaple!99',
      },
      { ipAddress: '127.0.0.1' },
    );

    // 1. Login & MFA setup/enable/verify
    const login1 = await auth.login(
      { organizationSlug: slugA, email: 'admin@hospa.org', password: 'CorrectHorseBatteryStaple!99' },
      {},
    );
    assert.equal(login1.mfaRequired, false);
    const claims1 = await tokens.verifyAccessToken(login1.accessToken);

    const mfaSetup = await auth.setupMfa(claims1);
    const code = generateTotpCode(mfaSetup.secret);
    await auth.enableMfa(claims1, code, {});

    const loginMfa = await auth.login(
      { organizationSlug: slugA, email: 'admin@hospa.org', password: 'CorrectHorseBatteryStaple!99' },
      {},
    );
    assert.equal(loginMfa.mfaRequired, true);
    const verifiedSession = await auth.verifyMfaChallenge(
      { mfaChallengeToken: loginMfa.mfaChallengeToken, code: generateTotpCode(mfaSetup.secret) },
      {},
    );
    assert.equal(verifiedSession.mfaRequired, false);

    // 2. Refresh token rotation & replay detection
    const rotated = await auth.refreshSession(verifiedSession.refreshToken, {});
    assert.ok(rotated.accessToken);
    await assert.rejects(() => auth.refreshSession(verifiedSession.refreshToken, {}));

    // 3. Register encrypted patient in Org A & verify Org B cannot see it via RLS
    const reg = await patientsSvc.registerPatient(
      claims1,
      {
        branchId: orgA.branchId,
        firstName: 'Ada',
        lastName: 'Okafor',
        dateOfBirth: '1992-03-15',
        gender: 'FEMALE',
        phone: '+2348099988877',
        bloodGroup: 'O+',
        genotype: 'AA',
        emergencyContacts: [],
      },
      {},
    );

    const foundA = await patientsSvc.searchPatients(claims1, { phone: '+2348099988877' }, {});
    assert.equal(foundA.length, 1);
    assert.equal(foundA[0]?.demographics.firstName, 'Ada');

    const claimsB = {
      sub: orgB.superAdminUserId,
      orgId: orgB.organizationId,
      branchId: orgB.branchId,
      role: 'SUPER_ADMIN' as const,
      mfaVerified: false,
    };
    const foundB = await patientsSvc.searchPatients(claimsB, { phone: '+2348099988877' }, {});
    assert.equal(foundB.length, 0);

    // 4. Verify vitals recording & EMR read
    await patientsSvc.recordVitals(claims1, reg.patientId, { systolicBp: 118, diastolicBp: 76 }, {});
    const emr = await patientsSvc.getPatientEmr(claims1, reg.patientId, {});
    assert.equal(emr.vitals.length, 1);

    // 5. Verify audit_logs immutability trigger blocks UPDATE/DELETE
    await assert.rejects(() =>
      dbService.db.execute(sql`UPDATE audit_logs SET action = 'TAMPERED'`),
    );
    await assert.rejects(() => dbService.db.execute(sql`DELETE FROM audit_logs`));

    // 6. Verify SHA-256 audit hash chain for BOTH Org A and Org B
    const chainA = await compliance.verifyAuditChain(claims1);
    assert.equal(chainA.valid, true);
    assert.ok(chainA.checkedCount >= 4);

    const chainB = await compliance.verifyAuditChain(claimsB);
    assert.equal(chainB.valid, true);
    assert.ok(chainB.checkedCount >= 2);
  });
});
