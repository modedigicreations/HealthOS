import { z } from 'zod';

export const BillingDepartmentSchema = z.enum([
  'CONSULTATION',
  'LABORATORY',
  'PHARMACY',
  'PROCEDURE',
  'ADMISSION_BED',
  'OTHER',
]);

export const UpsertServicePriceSchema = z.object({
  code: z.string().min(2).max(60),
  name: z.string().min(2).max(160),
  department: BillingDepartmentSchema,
  priceMinor: z.number().int().min(0),
});

export const InvoiceLineItemInputSchema = z.object({
  department: BillingDepartmentSchema,
  description: z.string().min(1).max(200),
  quantity: z.number().int().min(1),
  unitPriceMinor: z.number().int().min(0),
  referenceType: z.string().max(60).optional(),
  referenceId: z.string().uuid().optional(),
});

export const CreateInvoiceSchema = z.object({
  branchId: z.string().uuid(),
  patientId: z.string().uuid(),
  items: z.array(InvoiceLineItemInputSchema).min(1).max(100),
  discountMinor: z.number().int().min(0).default(0),
  dueDate: z.string().datetime().optional(),
});

export const RecordPaymentSchema = z.object({
  invoiceId: z.string().uuid().optional(),
  branchId: z.string().uuid(),
  patientId: z.string().uuid(),
  amountMinor: z.number().int().min(1),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'GATEWAY', 'DEPOSIT', 'HMO']),
  isDeposit: z.boolean().default(false),
  gatewayReference: z.string().max(120).optional(),
  idempotencyKey: z.string().min(8).max(120).optional(),
});

export const RefundPaymentSchema = z.object({
  paymentId: z.string().uuid(),
  amountMinor: z.number().int().min(1),
  reason: z.string().min(3).max(500),
});

export const SubmitHmoClaimSchema = z.object({
  branchId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  patientId: z.string().uuid(),
  hmoProvider: z.string().min(2).max(120),
  policyNumber: z.string().min(2).max(80),
  claimedAmountMinor: z.number().int().min(1),
});

export const ReconcileHmoClaimSchema = z.object({
  status: z.enum(['APPROVED', 'PAID', 'REJECTED']),
  approvedAmountMinor: z.number().int().min(0),
  settlementReference: z.string().max(120).optional(),
});

export type UpsertServicePriceDto = z.infer<typeof UpsertServicePriceSchema>;
export type CreateInvoiceDto = z.infer<typeof CreateInvoiceSchema>;
export type RecordPaymentDto = z.infer<typeof RecordPaymentSchema>;
export type RefundPaymentDto = z.infer<typeof RefundPaymentSchema>;
export type SubmitHmoClaimDto = z.infer<typeof SubmitHmoClaimSchema>;
export type ReconcileHmoClaimDto = z.infer<typeof ReconcileHmoClaimSchema>;
