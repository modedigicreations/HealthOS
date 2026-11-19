import { z } from 'zod';

export const CreateLabTestSchema = z.object({
  code: z.string().min(2).max(40),
  name: z.string().min(2).max(160),
  category: z.string().min(2).max(80),
  specimenType: z.string().min(2).max(60),
  priceMinor: z.number().int().min(0),
  turnaroundMinutes: z.number().int().min(5).max(43200).default(120),
  referenceRanges: z
    .array(
      z.object({
        parameter: z.string().min(1).max(80),
        unit: z.string().max(30),
        low: z.number().optional(),
        high: z.number().optional(),
      }),
    )
    .default([]),
  autoCalculationRule: z.enum(['NONE', 'LDL_FRIEDEWALD', 'AG_RATIO']).default('NONE'),
});

export const CreateLabOrderSchema = z.object({
  branchId: z.string().uuid(),
  patientId: z.string().uuid(),
  consultationId: z.string().uuid().optional(),
  testId: z.string().uuid(),
  priority: z.enum(['ROUTINE', 'URGENT', 'STAT']).default('ROUTINE'),
  clinicalNotes: z.string().max(1000).optional(),
  externalReferralLab: z.string().max(160).optional(),
});

export const RegisterSampleSchema = z.object({
  orderId: z.string().uuid(),
  specimenType: z.string().min(2).max(60),
  assignedTechnicianId: z.string().uuid().optional(),
});

export const UpdateSampleStatusSchema = z.object({
  status: z.enum(['RECEIVED', 'PROCESSING', 'REJECTED']),
  rejectionReason: z.string().max(500).optional(),
});

export const EnterLabResultSchema = z.object({
  orderId: z.string().uuid(),
  parameters: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        value: z.union([z.number(), z.string()]),
        unit: z.string().max(30).optional(),
        flag: z.enum(['NORMAL', 'LOW', 'HIGH', 'CRITICAL']).optional(),
      }),
    )
    .min(1),
  interpretation: z.string().max(2000).optional(),
});

export const RecordLabQcSchema = z.object({
  branchId: z.string().uuid(),
  equipmentName: z.string().min(2).max(120),
  controlLot: z.string().min(1).max(60),
  passed: z.boolean(),
  notes: z.string().max(1000).optional(),
});

export const UpsertLabReagentSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().min(2).max(120),
  lotNumber: z.string().min(1).max(60),
  quantityRemaining: z.number().int().min(0),
  reorderLevel: z.number().int().min(0),
  expiresAt: z.string().datetime(),
});

export type CreateLabTestDto = z.infer<typeof CreateLabTestSchema>;
export type CreateLabOrderDto = z.infer<typeof CreateLabOrderSchema>;
export type RegisterSampleDto = z.infer<typeof RegisterSampleSchema>;
export type UpdateSampleStatusDto = z.infer<typeof UpdateSampleStatusSchema>;
export type EnterLabResultDto = z.infer<typeof EnterLabResultSchema>;
export type RecordLabQcDto = z.infer<typeof RecordLabQcSchema>;
export type UpsertLabReagentDto = z.infer<typeof UpsertLabReagentSchema>;
