import { z } from 'zod';

export const CreateInventoryItemSchema = z.object({
  sku: z.string().min(2).max(60),
  name: z.string().min(2).max(160),
  itemType: z.enum(['MEDICINE', 'MEDICAL_SUPPLY', 'GENERAL_FACILITY']),
  genericName: z.string().max(160).optional(),
  dosageForm: z.string().max(60).optional(),
  strength: z.string().max(60).optional(),
  unitOfMeasure: z.string().min(1).max(30).default('UNIT'),
  reorderLevel: z.number().int().min(0).default(20),
  unitPriceMinor: z.number().int().min(0).default(0),
  drugClass: z.string().max(80).optional(),
});

export const ReceiveInventoryBatchSchema = z.object({
  branchId: z.string().uuid(),
  itemId: z.string().uuid(),
  batchNumber: z.string().min(1).max(80),
  lotNumber: z.string().max(80).optional(),
  quantity: z.number().int().min(1),
  unitCostMinor: z.number().int().min(0),
  expiresAt: z.string().datetime().optional(),
  supplierName: z.string().max(160).optional(),
});

export const DispensePrescriptionSchema = z.object({
  branchId: z.string().uuid(),
  prescriptionId: z.string().uuid().optional(),
  patientId: z.string().uuid(),
  itemId: z.string().uuid(),
  quantity: z.number().int().min(1),
  isRefill: z.boolean().default(false),
  overrideClinicalAlertReason: z.string().max(500).optional(),
});

export const TransferStockSchema = z.object({
  fromBranchId: z.string().uuid(),
  toBranchId: z.string().uuid(),
  batchId: z.string().uuid(),
  quantity: z.number().int().min(1),
  notes: z.string().max(500).optional(),
});

export const AdjustStockSchema = z.object({
  branchId: z.string().uuid(),
  batchId: z.string().uuid(),
  deltaQuantity: z.number().int(), // negative for damaged/expired/write-off, positive for count correction
  reason: z.enum(['RECONCILIATION', 'DAMAGED', 'EXPIRED', 'RETURN']),
  notes: z.string().max(500).optional(),
});

export type CreateInventoryItemDto = z.infer<typeof CreateInventoryItemSchema>;
export type ReceiveInventoryBatchDto = z.infer<typeof ReceiveInventoryBatchSchema>;
export type DispensePrescriptionDto = z.infer<typeof DispensePrescriptionSchema>;
export type TransferStockDto = z.infer<typeof TransferStockSchema>;
export type AdjustStockDto = z.infer<typeof AdjustStockSchema>;
