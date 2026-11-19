import { z } from 'zod';

// Module 10: Patient Engagement & Communication
export const SendNotificationSchema = z.object({
  branchId: z.string().uuid(),
  patientId: z.string().uuid(),
  channel: z.enum(['SMS', 'EMAIL', 'WHATSAPP', 'PORTAL']),
  notificationType: z.enum([
    'APPOINTMENT_REMINDER',
    'LAB_RESULT_READY',
    'PRESCRIPTION_REFILL',
    'FOLLOW_UP',
    'RECEIPT',
    'GENERAL',
  ]),
  message: z.string().min(2).max(2000),
});

export const SendSecureMessageSchema = z.object({
  branchId: z.string().uuid(),
  patientId: z.string().uuid(),
  recipientUserId: z.string().uuid(),
  subject: z.string().min(2).max(160),
  body: z.string().min(1).max(4000),
});

export const SubmitSurveySchema = z.object({
  branchId: z.string().uuid(),
  patientId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  feedback: z.string().max(2000).optional(),
});

export const CreateAnnouncementSchema = z.object({
  branchId: z.string().uuid().optional(),
  title: z.string().min(2).max(160),
  body: z.string().min(5).max(4000),
});

// Module 12: Multi-Branch & Organisation Management
export const CreateBranchSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(20),
  facilityType: z.enum(['HOSPITAL', 'CLINIC', 'LAB', 'PHARMACY']).default('CLINIC'),
  address: z.string().max(300).optional(),
});

export const AssignUserBranchSchema = z.object({
  userId: z.string().uuid(),
  branchId: z.string().uuid(),
  department: z.string().max(80).optional(),
  isDefault: z.boolean().default(false),
});

export type SendNotificationDto = z.infer<typeof SendNotificationSchema>;
export type SendSecureMessageDto = z.infer<typeof SendSecureMessageSchema>;
export type SubmitSurveyDto = z.infer<typeof SubmitSurveySchema>;
export type CreateAnnouncementDto = z.infer<typeof CreateAnnouncementSchema>;
export type CreateBranchDto = z.infer<typeof CreateBranchSchema>;
export type AssignUserBranchDto = z.infer<typeof AssignUserBranchSchema>;
