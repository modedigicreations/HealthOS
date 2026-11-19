import { z } from 'zod';

export const RegisterEquipmentSchema = z.object({
  branchId: z.string().uuid(),
  assetTag: z.string().min(2).max(60),
  name: z.string().min(2).max(160),
  serialNumber: z.string().max(100).optional(),
  department: z.string().min(2).max(80),
  nextPreventiveMaintenanceAt: z.string().datetime().optional(),
  nextCalibrationAt: z.string().datetime().optional(),
});

export const RecordEquipmentServiceSchema = z.object({
  equipmentId: z.string().uuid(),
  serviceType: z.enum(['PREVENTIVE', 'CALIBRATION', 'INSPECTION', 'REPAIR']),
  costMinor: z.number().int().min(0).default(0),
  downtimeMinutes: z.number().int().min(0).default(0),
  notes: z.string().min(2).max(2000),
  nextPreventiveMaintenanceAt: z.string().datetime().optional(),
  nextCalibrationAt: z.string().datetime().optional(),
});

export const CreateMaintenanceTicketSchema = z.object({
  branchId: z.string().uuid(),
  equipmentId: z.string().uuid().optional(),
  ticketType: z.enum(['EQUIPMENT_FAULT', 'FACILITY_MAINTENANCE']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  description: z.string().min(3).max(2000),
  assignedToUserId: z.string().uuid().optional(),
});

export const UpdateMaintenanceTicketSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'RESOLVED']),
  assignedToUserId: z.string().uuid().optional(),
});

export type RegisterEquipmentDto = z.infer<typeof RegisterEquipmentSchema>;
export type RecordEquipmentServiceDto = z.infer<typeof RecordEquipmentServiceSchema>;
export type CreateMaintenanceTicketDto = z.infer<typeof CreateMaintenanceTicketSchema>;
export type UpdateMaintenanceTicketDto = z.infer<typeof UpdateMaintenanceTicketSchema>;
