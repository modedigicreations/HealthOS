import { z } from 'zod';

export const EmergencyContactSchema = z.object({
  name: z.string().min(2).max(120),
  relationship: z.string().min(2).max(60),
  phone: z.string().min(5).max(30),
  email: z.string().email().optional(),
});

export const RegisterPatientSchema = z.object({
  branchId: z.string().uuid(),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']),
  phone: z.string().min(5).max(30),
  email: z.string().email().optional(),
  nationalId: z.string().min(4).max(40).optional(),
  address: z.string().max(300).optional(),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN']).default('UNKNOWN'),
  genotype: z.enum(['AA', 'AS', 'SS', 'AC', 'SC', 'UNKNOWN']).default('UNKNOWN'),
  nextOfKin: EmergencyContactSchema.optional(),
  emergencyContacts: z.array(EmergencyContactSchema).max(5).default([]),
  medicalHistorySummary: z.string().max(4000).optional(),
});

export const SearchPatientSchema = z.object({
  patientNumber: z.string().max(40).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  nationalId: z.string().max(40).optional(),
});

export const RecordVitalsSchema = z.object({
  systolicBp: z.number().int().min(40).max(300).optional(),
  diastolicBp: z.number().int().min(20).max(200).optional(),
  heartRateBpm: z.number().int().min(20).max(260).optional(),
  temperatureC: z.number().min(30).max(45).optional(),
  respiratoryRate: z.number().int().min(5).max(80).optional(),
  spo2Percent: z.number().int().min(40).max(100).optional(),
  weightKg: z.number().min(0.5).max(500).optional(),
  heightCm: z.number().min(20).max(260).optional(),
  notes: z.string().max(1000).optional(),
});

export const RecordAllergySchema = z.object({
  allergen: z.string().min(1).max(120),
  category: z.enum(['DRUG', 'FOOD', 'ENVIRONMENTAL', 'OTHER']),
  severity: z.enum(['MILD', 'MODERATE', 'SEVERE', 'LIFE_THREATENING']),
  reaction: z.string().min(1).max(500),
});

export const RecordMedicationHistorySchema = z.object({
  medicationName: z.string().min(1).max(160),
  dosage: z.string().max(80).optional(),
  frequency: z.string().max(80).optional(),
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
  isCurrent: z.boolean().default(true),
  notes: z.string().max(500).optional(),
});

export const UpdateConsentSchema = z.object({
  consentType: z.enum([
    'INTER_DEPARTMENT_SHARING',
    'INTER_BRANCH_SHARING',
    'PORTAL_ACCESS',
    'TELEMEDICINE',
    'RESEARCH',
  ]),
  granted: z.boolean(),
  scopeDepartment: z.string().max(80).optional(),
  notes: z.string().max(500).optional(),
});

export const CreateReferralSchema = z.object({
  fromDepartment: z.string().min(2).max(80),
  toDepartment: z.string().min(2).max(80),
  toBranchId: z.string().uuid().optional(),
  externalFacility: z.string().max(160).optional(),
  reason: z.string().min(5).max(2000),
  clinicalSummary: z.string().max(4000).optional(),
});

export const MergePatientsSchema = z.object({
  primaryPatientId: z.string().uuid(),
  duplicatePatientId: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

export const BreakGlassAccessSchema = z.object({
  reason: z.string().min(10).max(500),
});

export type RegisterPatientDto = z.infer<typeof RegisterPatientSchema>;
export type SearchPatientDto = z.infer<typeof SearchPatientSchema>;
export type RecordVitalsDto = z.infer<typeof RecordVitalsSchema>;
export type RecordAllergyDto = z.infer<typeof RecordAllergySchema>;
export type RecordMedicationHistoryDto = z.infer<typeof RecordMedicationHistorySchema>;
export type UpdateConsentDto = z.infer<typeof UpdateConsentSchema>;
export type CreateReferralDto = z.infer<typeof CreateReferralSchema>;
export type MergePatientsDto = z.infer<typeof MergePatientsSchema>;
export type BreakGlassAccessDto = z.infer<typeof BreakGlassAccessSchema>;
