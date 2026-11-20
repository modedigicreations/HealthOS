import { z } from 'zod';

export const AssistantQuerySchema = z.object({
  question: z.string().min(3).max(500),
  branchId: z.string().uuid().optional(),
});

export const KioskCheckInSchema = z.object({
  branchId: z.string().uuid(),
  patientNumber: z.string().min(3).max(40),
  phone: z.string().min(5).max(30),
  appointmentId: z.string().uuid(),
});

export const CreateTelemedicineSessionSchema = z.object({
  appointmentId: z.string().uuid(),
  patientId: z.string().uuid(),
});

export type AssistantQueryDto = z.infer<typeof AssistantQuerySchema>;
export type KioskCheckInDto = z.infer<typeof KioskCheckInSchema>;
export type CreateTelemedicineSessionDto = z.infer<typeof CreateTelemedicineSessionSchema>;
