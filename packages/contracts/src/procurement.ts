import { z } from 'zod';

export const RegisterSupplierSchema = z.object({
  name: z.string().min(2).max(160),
  category: z.enum(['PHARMACEUTICALS', 'MEDICAL_SUPPLIES', 'LAB_REAGENTS', 'EQUIPMENT', 'GENERAL']),
  contactName: z.string().min(2).max(120),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(5).max(30),
  taxId: z.string().max(60).optional(),
  bankDetails: z.string().max(300).optional(),
});

export const VerifySupplierSchema = z.object({
  verificationStatus: z.enum(['VERIFIED', 'SUSPENDED']),
  ratingScore: z.number().int().min(1).max(5).optional(),
});

export const CreatePurchaseRequisitionSchema = z.object({
  branchId: z.string().uuid(),
  items: z
    .array(
      z.object({
        inventoryItemId: z.string().uuid().optional(),
        description: z.string().min(2).max(200),
        quantity: z.number().int().min(1),
      }),
    )
    .min(1),
  justification: z.string().max(1000).optional(),
});

export const SubmitRfqQuoteSchema = z.object({
  requisitionId: z.string().uuid(),
  supplierId: z.string().uuid(),
  totalQuotedMinor: z.number().int().min(0),
  leadTimeDays: z.number().int().min(1).max(365),
  lineQuotes: z
    .array(
      z.object({
        description: z.string().min(1).max(200),
        unitPriceMinor: z.number().int().min(0),
        quantity: z.number().int().min(1),
      }),
    )
    .min(1),
});

export const CreatePurchaseOrderSchema = z.object({
  branchId: z.string().uuid(),
  supplierId: z.string().uuid(),
  requisitionId: z.string().uuid().optional(),
  items: z
    .array(
      z.object({
        inventoryItemId: z.string().uuid().optional(),
        description: z.string().min(1).max(200),
        quantity: z.number().int().min(1),
        unitPriceMinor: z.number().int().min(0),
      }),
    )
    .min(1),
  expectedDeliveryAt: z.string().datetime().optional(),
});

export const RecordGrnSchema = z.object({
  purchaseOrderId: z.string().uuid(),
  deliveryNoteNumber: z.string().min(1).max(80),
  receivedItems: z
    .array(
      z.object({
        inventoryItemId: z.string().uuid().optional(),
        batchNumber: z.string().min(1).max(80),
        quantityReceived: z.number().int().min(1),
        unitCostMinor: z.number().int().min(0),
        expiresAt: z.string().datetime().optional(),
      }),
    )
    .min(1),
  notes: z.string().max(500).optional(),
});

export const RecordSupplierInvoiceSchema = z.object({
  purchaseOrderId: z.string().uuid(),
  supplierId: z.string().uuid(),
  invoiceNumber: z.string().min(1).max(80),
  amountMinor: z.number().int().min(0),
  dueDate: z.string().datetime(),
});

export type RegisterSupplierDto = z.infer<typeof RegisterSupplierSchema>;
export type VerifySupplierDto = z.infer<typeof VerifySupplierSchema>;
export type CreatePurchaseRequisitionDto = z.infer<typeof CreatePurchaseRequisitionSchema>;
export type SubmitRfqQuoteDto = z.infer<typeof SubmitRfqQuoteSchema>;
export type CreatePurchaseOrderDto = z.infer<typeof CreatePurchaseOrderSchema>;
export type RecordGrnDto = z.infer<typeof RecordGrnSchema>;
export type RecordSupplierInvoiceDto = z.infer<typeof RecordSupplierInvoiceSchema>;
