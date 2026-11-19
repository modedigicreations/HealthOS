import { z } from 'zod';

/**
 * All 12 user roles defined in HealthOS Section 4 specification.
 */
export const UserRoleSchema = z.enum([
  'SUPER_ADMIN',
  'FACILITY_ADMIN',
  'MEDICAL_DIRECTOR',
  'DOCTOR',
  'NURSE',
  'LAB_SCIENTIST',
  'PHARMACIST',
  'ACCOUNTANT',
  'PROCUREMENT_OFFICER',
  'COMPLIANCE_OFFICER',
  'RECEPTIONIST',
  'PATIENT',
]);

export type UserRole = z.infer<typeof UserRoleSchema>;

/**
 * Granular permissions across all 12 HealthOS modules + security core.
 */
export const PermissionSchema = z.enum([
  // Module 1: Patient & EMR
  'patient:read',
  'patient:create',
  'patient:update',
  'patient:merge',
  'emr:read',
  'emr:write',
  'emr:consent_manage',
  'emr:break_glass',

  // Module 2: Appointments & Clinical
  'appointment:read',
  'appointment:book',
  'appointment:checkin',
  'consultation:read',
  'consultation:write',
  'prescription:write',
  'ward:manage',

  // Module 3: Laboratory (LIMS)
  'lab:order',
  'lab:sample_collect',
  'lab:result_enter',
  'lab:result_authorize',
  'lab:qc_manage',

  // Module 4: Pharmacy & Inventory
  'pharmacy:dispense',
  'inventory:read',
  'inventory:adjust',
  'inventory:transfer',

  // Module 5: Procurement & Suppliers
  'procurement:requisition',
  'procurement:rfq',
  'procurement:approve',
  'procurement:grn',

  // Module 6: Billing & Finance
  'billing:read',
  'billing:invoice',
  'billing:payment_record',
  'billing:refund',
  'hmo:manage',
  'finance:reports',

  // Module 7: Staff & HR
  'hr:read',
  'hr:manage',
  'roster:manage',

  // Module 8: Compliance & QA
  'compliance:read',
  'compliance:manage',
  'incident:report',
  'audit:read',

  // Module 9: Equipment & Facility
  'equipment:read',
  'equipment:manage',

  // Module 10: Patient Engagement
  'engagement:communicate',

  // Module 11: Analytics & BI
  'analytics:read',
  'analytics:export',

  // Module 12: Multi-Branch & Org
  'org:manage',
  'branch:manage',
]);

export type Permission = z.infer<typeof PermissionSchema>;

const ALL_PERMISSIONS = PermissionSchema.options;

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,

  FACILITY_ADMIN: [
    'patient:read',
    'patient:create',
    'patient:update',
    'appointment:read',
    'appointment:book',
    'appointment:checkin',
    'inventory:read',
    'inventory:transfer',
    'procurement:requisition',
    'procurement:approve',
    'billing:read',
    'finance:reports',
    'hr:read',
    'hr:manage',
    'roster:manage',
    'compliance:read',
    'audit:read',
    'equipment:read',
    'equipment:manage',
    'engagement:communicate',
    'analytics:read',
    'analytics:export',
    'branch:manage',
  ],

  MEDICAL_DIRECTOR: [
    'patient:read',
    'patient:merge',
    'emr:read',
    'emr:break_glass',
    'appointment:read',
    'consultation:read',
    'consultation:write',
    'prescription:write',
    'ward:manage',
    'lab:order',
    'lab:result_authorize',
    'compliance:read',
    'incident:report',
    'audit:read',
    'hr:read',
    'roster:manage',
    'analytics:read',
    'analytics:export',
  ],

  DOCTOR: [
    'patient:read',
    'patient:create',
    'patient:update',
    'emr:read',
    'emr:write',
    'emr:consent_manage',
    'emr:break_glass',
    'appointment:read',
    'appointment:book',
    'consultation:read',
    'consultation:write',
    'prescription:write',
    'ward:manage',
    'lab:order',
    'incident:report',
    'engagement:communicate',
  ],

  NURSE: [
    'patient:read',
    'patient:update',
    'emr:read',
    'emr:write',
    'appointment:read',
    'appointment:checkin',
    'consultation:read',
    'ward:manage',
    'lab:sample_collect',
    'incident:report',
  ],

  LAB_SCIENTIST: [
    'patient:read',
    'lab:sample_collect',
    'lab:result_enter',
    'lab:result_authorize',
    'lab:qc_manage',
    'inventory:read',
    'equipment:read',
    'incident:report',
  ],

  PHARMACIST: [
    'patient:read',
    'emr:read',
    'pharmacy:dispense',
    'inventory:read',
    'inventory:adjust',
    'inventory:transfer',
    'procurement:requisition',
    'incident:report',
  ],

  ACCOUNTANT: [
    'patient:read',
    'billing:read',
    'billing:invoice',
    'billing:payment_record',
    'billing:refund',
    'hmo:manage',
    'finance:reports',
    'analytics:read',
    'analytics:export',
  ],

  PROCUREMENT_OFFICER: [
    'inventory:read',
    'procurement:requisition',
    'procurement:rfq',
    'procurement:grn',
    'equipment:read',
  ],

  COMPLIANCE_OFFICER: [
    'compliance:read',
    'compliance:manage',
    'incident:report',
    'audit:read',
    'hr:read',
    'equipment:read',
    'analytics:read',
    'analytics:export',
  ],

  RECEPTIONIST: [
    'patient:read',
    'patient:create',
    'patient:update',
    'emr:consent_manage',
    'appointment:read',
    'appointment:book',
    'appointment:checkin',
    'billing:read',
    'billing:invoice',
    'billing:payment_record',
    'engagement:communicate',
  ],

  PATIENT: [
    'patient:read',
    'emr:read',
    'emr:consent_manage',
    'appointment:read',
    'appointment:book',
    'billing:read',
    'engagement:communicate',
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function hasAllPermissions(role: UserRole, permissions: readonly Permission[]): boolean {
  return permissions.every((perm) => hasPermission(role, perm));
}
