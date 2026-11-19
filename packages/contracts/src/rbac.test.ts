import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UserRoleSchema, hasPermission, hasAllPermissions } from './rbac.js';

describe('@healthos/contracts RBAC', () => {
  it('defines all 12 HealthOS roles', () => {
    assert.equal(UserRoleSchema.options.length, 12);
  });

  it('enforces least-privilege separation between clinical, lab, pharmacy, and billing', () => {
    assert.equal(hasPermission('DOCTOR', 'consultation:write'), true);
    assert.equal(hasPermission('DOCTOR', 'billing:refund'), false);

    assert.equal(hasPermission('LAB_SCIENTIST', 'lab:result_authorize'), true);
    assert.equal(hasPermission('LAB_SCIENTIST', 'pharmacy:dispense'), false);

    assert.equal(hasPermission('PHARMACIST', 'pharmacy:dispense'), true);
    assert.equal(hasPermission('PHARMACIST', 'consultation:write'), false);

    assert.equal(hasPermission('ACCOUNTANT', 'billing:refund'), true);
    assert.equal(hasPermission('ACCOUNTANT', 'emr:write'), false);

    assert.equal(hasPermission('PATIENT', 'emr:read'), true);
    assert.equal(hasPermission('PATIENT', 'emr:write'), false);
  });

  it('grants SUPER_ADMIN full platform permissions', () => {
    assert.equal(
      hasAllPermissions('SUPER_ADMIN', ['org:manage', 'branch:manage', 'audit:read', 'emr:break_glass']),
      true,
    );
  });
});
