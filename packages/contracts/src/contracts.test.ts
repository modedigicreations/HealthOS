import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BootstrapOrgSchema,
  RegisterPatientSchema,
  RecordVitalsSchema,
  UpdateConsentSchema,
} from './index.js';

describe('@healthos/contracts Module 1 & Auth DTOs', () => {
  it('validates BootstrapOrgSchema and rejects weak passwords', () => {
    const bad = BootstrapOrgSchema.safeParse({
      organizationName: 'Mode General Hospital',
      organizationSlug: 'mode-general',
      branchName: 'Main Campus',
      branchCode: 'MAIN',
      adminEmail: 'admin@modehospital.org',
      adminFullName: 'Ada Lovelace',
      adminPassword: 'short',
    });
    assert.equal(bad.success, false);

    const good = BootstrapOrgSchema.safeParse({
      organizationName: 'Mode General Hospital',
      organizationSlug: 'mode-general',
      branchName: 'Main Campus',
      branchCode: 'MAIN',
      adminEmail: 'admin@modehospital.org',
      adminFullName: 'Ada Lovelace',
      adminPassword: 'CorrectHorseBatteryStaple!99',
    });
    assert.equal(good.success, true);
  });

  it('validates RegisterPatientSchema, RecordVitalsSchema, and UpdateConsentSchema', () => {
    const patient = RegisterPatientSchema.safeParse({
      branchId: '11111111-1111-4111-8111-111111111111',
      firstName: 'Chidi',
      lastName: 'Okafor',
      dateOfBirth: '1990-05-14',
      gender: 'MALE',
      phone: '+2348001234567',
      bloodGroup: 'O+',
      genotype: 'AA',
    });
    assert.equal(patient.success, true);

    const vitals = RecordVitalsSchema.safeParse({
      systolicBp: 120,
      diastolicBp: 80,
      heartRateBpm: 72,
      temperatureC: 36.8,
      spo2Percent: 99,
      weightKg: 74.5,
      heightCm: 178,
    });
    assert.equal(vitals.success, true);

    const consent = UpdateConsentSchema.safeParse({
      consentType: 'INTER_DEPARTMENT_SHARING',
      granted: true,
      scopeDepartment: 'LABORATORY',
    });
    assert.equal(consent.success, true);
  });
});
