import { z } from 'zod';

export const UpsertDoctorProfileSchema = z.object({
  userId: z.string().uuid(),
  branchId: z.string().uuid(),
  specialty: z.string().min(2).max(120),
  licenceNumber: z.string().min(2).max(80),
  consultationFeeMinor: z.number().int().min(0).default(0),
  telemedicineEnabled: z.boolean().default(false),
  bio: z.string().max(1000).optional(),
});

export const CreateDoctorScheduleSchema = z.object({
  doctorUserId: z.string().uuid(),
  branchId: z.string().uuid(),
  dayOfWeek: z.number().int().min(0).max(6), // 0 = Sunday .. 6 = Saturday
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  slotDurationMinutes: z.number().int().min(5).max(120).default(20),
});

export const BookAppointmentSchema = z.object({
  branchId: z.string().uuid(),
  patientId: z.string().uuid(),
  doctorUserId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  bookingChannel: z.enum(['ONLINE', 'MANUAL', 'KIOSK']).default('MANUAL'),
  visitType: z.enum(['OUTPATIENT', 'INPATIENT', 'TELEMEDICINE', 'FOLLOW_UP']).default('OUTPATIENT'),
  reason: z.string().max(1000).optional(),
});

export const PrescriptionItemSchema = z.object({
  medicationName: z.string().min(1).max(160),
  dosage: z.string().min(1).max(80),
  frequency: z.string().min(1).max(80),
  durationDays: z.number().int().min(1).max(365),
  quantity: z.number().int().min(1).max(1000),
  instructions: z.string().max(500).optional(),
});

export const CreateConsultationSchema = z.object({
  appointmentId: z.string().uuid().optional(),
  branchId: z.string().uuid(),
  patientId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
  chiefComplaint: z.string().min(1).max(2000),
  examinationNotes: z.string().max(8000).optional(),
  diagnosisCode: z.string().max(30).optional(),
  diagnosisDescription: z.string().min(1).max(1000),
  treatmentPlan: z.string().max(4000).optional(),
  followUpDate: z.string().datetime().optional(),
  prescriptions: z.array(PrescriptionItemSchema).max(25).default([]),
  procedures: z
    .array(
      z.object({
        procedureCode: z.string().max(40).optional(),
        procedureName: z.string().min(2).max(160),
        notes: z.string().max(2000).optional(),
      }),
    )
    .max(15)
    .default([]),
});

export const CreateClinicalTemplateSchema = z.object({
  name: z.string().min(2).max(120),
  specialty: z.string().min(2).max(80),
  sections: z
    .array(
      z.object({
        key: z.string().min(1).max(60),
        label: z.string().min(1).max(120),
        type: z.enum(['TEXT', 'TEXTAREA', 'SELECT', 'CHECKBOX']),
        options: z.array(z.string()).optional(),
      }),
    )
    .min(1)
    .max(30),
});

export const CreateWardSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().min(2).max(100),
  wardType: z.enum(['GENERAL', 'PRIVATE', 'ICU', 'MATERNITY', 'PEDIATRIC', 'EMERGENCY']),
  bedLabels: z.array(z.string().min(1).max(30)).min(1).max(100),
});

export const AdmitPatientSchema = z.object({
  branchId: z.string().uuid(),
  patientId: z.string().uuid(),
  attendingDoctorId: z.string().uuid(),
  bedId: z.string().uuid(),
  admissionReason: z.string().min(3).max(2000),
});

export const DischargePatientSchema = z.object({
  dischargeSummary: z.string().min(5).max(8000),
  dischargeDisposition: z.enum(['HOME', 'TRANSFERRED', 'AMA', 'DECEASED']).default('HOME'),
});

export type UpsertDoctorProfileDto = z.infer<typeof UpsertDoctorProfileSchema>;
export type CreateDoctorScheduleDto = z.infer<typeof CreateDoctorScheduleSchema>;
export type BookAppointmentDto = z.infer<typeof BookAppointmentSchema>;
export type CreateConsultationDto = z.infer<typeof CreateConsultationSchema>;
export type CreateClinicalTemplateDto = z.infer<typeof CreateClinicalTemplateSchema>;
export type CreateWardDto = z.infer<typeof CreateWardSchema>;
export type AdmitPatientDto = z.infer<typeof AdmitPatientSchema>;
export type DischargePatientDto = z.infer<typeof DischargePatientSchema>;
