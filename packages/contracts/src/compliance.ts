import { z } from 'zod';

export const CreateComplianceChecklistSchema = z.object({
  branchId: z.string().uuid(),
  jurisdiction: z.string().min(2).max(20),
  category: z.string().min(2).max(80),
  title: z.string().min(2).max(160),
  items: z
    .array(
      z.object({
        code: z.string().min(1).max(40),
        requirement: z.string().min(2).max(300),
        compliant: z.boolean().default(false),
      }),
    )
    .min(1),
});

export const RecordFacilityLicenceSchema = z.object({
  branchId: z.string().uuid(),
  licenceName: z.string().min(2).max(160),
  authority: z.string().min(2).max(160),
  licenceNumber: z.string().min(2).max(80),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export const CreateSopSchema = z.object({
  department: z.string().min(2).max(80),
  title: z.string().min(2).max(160),
  version: z.string().min(1).max(20),
  contentChecksum: z.string().min(16).max(128),
  storageKey: z.string().min(3).max(300),
});

export const ReportIncidentSchema = z.object({
  branchId: z.string().uuid(),
  category: z.enum([
    'CLINICAL',
    'INFECTION_CONTROL',
    'MEDICATION_ERROR',
    'EQUIPMENT',
    'SECURITY',
    'COMPLAINT',
  ]),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  description: z.string().min(5).max(4000),
});

export const CreateCapaSchema = z.object({
  branchId: z.string().uuid(),
  incidentId: z.string().uuid().optional(),
  title: z.string().min(3).max(200),
  actionPlan: z.string().min(5).max(2000),
  assignedToUserId: z.string().uuid(),
  dueAt: z.string().datetime(),
});

export const UpdateCapaStatusSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'VERIFIED_CLOSED']),
});

export type CreateComplianceChecklistDto = z.infer<typeof CreateComplianceChecklistSchema>;
export type RecordFacilityLicenceDto = z.infer<typeof RecordFacilityLicenceSchema>;
export type CreateSopDto = z.infer<typeof CreateSopSchema>;
export type ReportIncidentDto = z.infer<typeof ReportIncidentSchema>;
export type CreateCapaDto = z.infer<typeof CreateCapaSchema>;
export type UpdateCapaStatusDto = z.infer<typeof UpdateCapaStatusSchema>;
