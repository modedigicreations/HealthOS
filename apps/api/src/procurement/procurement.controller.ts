import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  CreatePurchaseOrderSchema,
  CreatePurchaseRequisitionSchema,
  RecordGrnSchema,
  RecordSupplierInvoiceSchema,
  RegisterSupplierSchema,
  SubmitRfqQuoteSchema,
  VerifySupplierSchema,
  type CreatePurchaseOrderDto,
  type CreatePurchaseRequisitionDto,
  type RecordGrnDto,
  type RecordSupplierInvoiceDto,
  type RegisterSupplierDto,
  type SubmitRfqQuoteDto,
  type VerifySupplierDto,
} from '@healthos/contracts';
import { CurrentUser, RequirePermissions } from '../security/auth.guard.js';
import type { AccessTokenClaims } from '../security/security.module.js';
import { ZodValidationPipe } from '../common/zod-pipe.js';
import { ProcurementService } from './procurement.service.js';

function extractMeta(req: Request) {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

@Controller('v1/procurement')
export class ProcurementController {
  constructor(private readonly procurement: ProcurementService) {}

  @RequirePermissions('procurement:rfq')
  @Post('suppliers')
  registerSupplier(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(RegisterSupplierSchema)) dto: RegisterSupplierDto,
    @Req() req: Request,
  ) {
    return this.procurement.registerSupplier(actor, dto, extractMeta(req));
  }

  @RequirePermissions('procurement:approve')
  @Patch('suppliers/:id/verify')
  verifySupplier(
    @CurrentUser() actor: AccessTokenClaims,
    @Param('id', ParseUUIDPipe) supplierId: string,
    @Body(new ZodValidationPipe(VerifySupplierSchema)) dto: VerifySupplierDto,
    @Req() req: Request,
  ) {
    return this.procurement.verifySupplier(actor, supplierId, dto, extractMeta(req));
  }

  @RequirePermissions('procurement:requisition')
  @Post('requisitions')
  createRequisition(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(CreatePurchaseRequisitionSchema)) dto: CreatePurchaseRequisitionDto,
  ) {
    return this.procurement.createRequisition(actor, dto);
  }

  @RequirePermissions('procurement:rfq')
  @Post('rfqs/quotes')
  submitQuote(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(SubmitRfqQuoteSchema)) dto: SubmitRfqQuoteDto,
  ) {
    return this.procurement.submitRfqQuote(actor, dto);
  }

  @RequirePermissions('procurement:rfq')
  @Get('requisitions/:id/quotes')
  compareQuotes(
    @CurrentUser() actor: AccessTokenClaims,
    @Param('id', ParseUUIDPipe) requisitionId: string,
  ) {
    return this.procurement.compareQuotes(actor, requisitionId);
  }

  @RequirePermissions('procurement:requisition')
  @Post('purchase-orders')
  createPo(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(CreatePurchaseOrderSchema)) dto: CreatePurchaseOrderDto,
    @Req() req: Request,
  ) {
    return this.procurement.createPurchaseOrder(actor, dto, extractMeta(req));
  }

  @RequirePermissions('procurement:approve')
  @Post('purchase-orders/:id/approve')
  approvePo(
    @CurrentUser() actor: AccessTokenClaims,
    @Param('id', ParseUUIDPipe) poId: string,
    @Req() req: Request,
  ) {
    return this.procurement.approvePurchaseOrder(actor, poId, extractMeta(req));
  }

  @RequirePermissions('procurement:grn')
  @Post('grn')
  recordGrn(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(RecordGrnSchema)) dto: RecordGrnDto,
    @Req() req: Request,
  ) {
    return this.procurement.recordGrn(actor, dto, extractMeta(req));
  }

  @RequirePermissions('procurement:grn')
  @Post('invoices')
  recordInvoice(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(RecordSupplierInvoiceSchema)) dto: RecordSupplierInvoiceDto,
  ) {
    return this.procurement.recordSupplierInvoice(actor, dto);
  }

  @RequirePermissions('procurement:requisition')
  @Get('branches/:branchId/recommendations')
  reorderRecommendations(
    @CurrentUser() actor: AccessTokenClaims,
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.procurement.getReorderRecommendations(actor, branchId);
  }
}
