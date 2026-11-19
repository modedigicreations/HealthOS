import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { redactPhi } from '../common/phi-redactor.js';
import { TokenService } from './security.module.js';
import { loadEnv } from '../common/env.js';

describe('@healthos/api security core', () => {
  it('redacts PHI, credentials, and encrypted fields from log metadata', () => {
    const redacted = redactPhi({
      patientId: 'pat-123',
      diagnosis: 'Acute Asthma',
      password: 'super-secret-password',
      emailEncrypted: 'env1.ciphertext',
      nested: {
        clinicalNotes: 'Sensitive note',
        action: 'VIEW',
      },
    });

    assert.equal(redacted.patientId, 'pat-123');
    assert.equal(redacted.diagnosis, '[REDACTED]');
    assert.equal(redacted.password, '[REDACTED]');
    assert.equal(redacted.emailEncrypted, '[REDACTED]');
    assert.equal(redacted.nested.clinicalNotes, '[REDACTED]');
    assert.equal(redacted.nested.action, 'VIEW');
  });

  it('signs and verifies JWT access tokens with tenant & MFA claims', async () => {
    const tokens = new TokenService(loadEnv());
    const jwt = await tokens.signAccessToken({
      sub: 'user-001',
      orgId: 'org-001',
      branchId: 'branch-001',
      role: 'DOCTOR',
      mfaVerified: true,
    });

    const verified = await tokens.verifyAccessToken(jwt);
    assert.equal(verified.sub, 'user-001');
    assert.equal(verified.orgId, 'org-001');
    assert.equal(verified.role, 'DOCTOR');
    assert.equal(verified.mfaVerified, true);
  });
});
