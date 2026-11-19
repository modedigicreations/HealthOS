import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LocalKmsProvider,
  EnvelopeCipher,
  BlindIndex,
  hashPassword,
  verifyPassword,
  computeAuditEntryHash,
  hashAuditPayload,
  GENESIS_AUDIT_HASH,
  generateTotpSecret,
  generateTotpCode,
  verifyTotpCode,
  buildTotpUri,
} from './index.js';

const TEST_KEK = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const TEST_BLIND_KEY = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

describe('@healthos/crypto', () => {
  it('encrypts and decrypts PHI with AAD binding and rejects cross-tenant tampering', async () => {
    const kms = new LocalKmsProvider(TEST_KEK);
    const cipher = new EnvelopeCipher(kms);

    const ctx = {
      organizationId: 'org-hospital-a',
      tableName: 'patients',
      recordId: 'pat-001',
      fieldName: 'diagnosis_notes',
    };

    const secretPhi = 'Patient presents with acute hypertension; prescribed Lisinopril 10mg.';
    const encrypted = await cipher.encryptString(secretPhi, ctx);

    assert.ok(encrypted.startsWith('env1.local-kek-v1.'));
    assert.ok(!encrypted.includes('hypertension'));

    const decrypted = await cipher.decryptString(encrypted, ctx);
    assert.equal(decrypted, secretPhi);

    // Cross-tenant AAD mismatch must fail
    await assert.rejects(() =>
      cipher.decryptString(encrypted, { ...ctx, organizationId: 'org-hospital-b' }),
    );

    // Tampered ciphertext must fail
    const tampered = encrypted.slice(0, -2) + (encrypted.endsWith('AA') ? 'BB' : 'AA');
    await assert.rejects(() => cipher.decryptString(tampered, ctx));
  });

  it('computes deterministic normalized blind indexes scoped per organization', () => {
    const blind = new BlindIndex(TEST_BLIND_KEY);
    const h1 = blind.compute('  Ada.Lovelace@Hospital.org ', {
      organizationId: 'org-1',
      field: 'email',
    });
    const h2 = blind.compute('ada.lovelace@hospital.org', {
      organizationId: 'org-1',
      field: 'email',
    });
    const h3 = blind.compute('ada.lovelace@hospital.org', {
      organizationId: 'org-2',
      field: 'email',
    });

    assert.equal(h1, h2);
    assert.notEqual(h1, h3);
    assert.equal(h1.length, 64);
  });

  it('hashes and verifies passwords with scrypt and rejects weak passwords', async () => {
    await assert.rejects(() => hashPassword('short'));
    const hash = await hashPassword('CorrectHorseBatteryStaple!99');
    assert.equal(await verifyPassword('CorrectHorseBatteryStaple!99', hash), true);
    assert.equal(await verifyPassword('WrongPassword12345', hash), false);
  });

  it('builds a tamper-evident audit hash chain', () => {
    const payloadHash = hashAuditPayload({ patientId: 'pat-001', action: 'VIEW_EMR' });
    const entry1 = computeAuditEntryHash({
      sequenceId: 1,
      prevHash: GENESIS_AUDIT_HASH,
      occurredAtIso: '2026-11-19T23:00:00.000Z',
      organizationId: 'org-1',
      branchId: 'branch-main',
      actorId: 'doc-1',
      actorRole: 'DOCTOR',
      action: 'PHI_READ',
      resourceType: 'patient_record',
      resourceId: 'pat-001',
      metadataHash: payloadHash,
    });
    const entry2 = computeAuditEntryHash({
      sequenceId: 2,
      prevHash: entry1,
      occurredAtIso: '2026-11-19T23:01:00.000Z',
      organizationId: 'org-1',
      branchId: 'branch-main',
      actorId: 'doc-1',
      actorRole: 'DOCTOR',
      action: 'PHI_UPDATE',
      resourceType: 'patient_record',
      resourceId: 'pat-001',
      metadataHash: payloadHash,
    });

    assert.equal(entry1.length, 64);
    assert.notEqual(entry1, entry2);
  });

  it('generates and verifies RFC 6238 TOTP MFA codes', () => {
    const secret = generateTotpSecret();
    const uri = buildTotpUri({ secret, accountName: 'dr.ada@healthos.io' });
    assert.ok(uri.startsWith('otpauth://totp/HealthOS:'));

    const now = 1_760_000_000_000;
    const code = generateTotpCode(secret, now);
    assert.match(code, /^\d{6}$/);
    assert.equal(verifyTotpCode(secret, code, now), true);
    assert.equal(verifyTotpCode(secret, code, now + 30_000), true);
    assert.equal(verifyTotpCode(secret, '000000', now + 120_000), false);
  });
});
