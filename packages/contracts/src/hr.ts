import { z } from 'zod';

export const UpsertStaffProfileSchema = z.object({
  userId: z.string().uuid(),
  branchId: z.string().uuid(),
  employeeCode: z.string().min(2).max(40),
  department: z.string().min(2).max(80),
  designation: z.string().min(2).max(100),
  phone: z.string().min(5).max(30),
  emergencyContact: z.string().max(200).optional(),
});

export const RecordStaffLicenceSchema = z.object({
  userId: z.string().uuid(),
  licenceType: z.string().min(2).max(100),
  issuingBody: z.string().min(2).max(120),
  licenceNumber: z.string().min(2).max(80),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export const CreateShiftSchema = z.object({
  branchId: z.string().uuid(),
  userId: z.string().uuid(),
  department: z.string().min(2).max(80),
  shiftType: z.enum(['MORNING', 'AFTERNOON', 'NIGHT', 'ON_CALL']),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

export const ClockAttendanceSchema = z.object({
  branchId: z.string().uuid(),
  shiftId: z.string().uuid().optional(),
  action: z.enum(['CLOCK_IN', 'CLOCK_OUT']),
});

export const RequestLeaveSchema = z.object({
  leaveType: z.enum(['ANNUAL', 'SICK', 'MATERNITY', 'STUDY', 'UNPAID']),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  reason: z.string().min(3).max(500),
});

export const DecideLeaveSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
});

export const AssignStaffTaskSchema = z.object({
  branchId: z.string().uuid(),
  assignedToUserId: z.string().uuid(),
  title: z.string().min(2).max(160),
  description: z.string().max(1000).optional(),
  dueAt: z.string().datetime().optional(),
});

export type UpsertStaffProfileDto = z.infer<typeof UpsertStaffProfileSchema>;
export type RecordStaffLicenceDto = z.infer<typeof RecordStaffLicenceSchema>;
export type CreateShiftDto = z.infer<typeof CreateShiftSchema>;
export type ClockAttendanceDto = z.infer<typeof ClockAttendanceSchema>;
export type RequestLeaveDto = z.infer<typeof RequestLeaveSchema>;
export type DecideLeaveDto = z.infer<typeof DecideLeaveSchema>;
export type AssignStaffTaskDto = z.infer<typeof AssignStaffTaskSchema>;
