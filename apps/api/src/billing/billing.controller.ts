import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  CreateInvoiceSchema,
  ReconcileHmoClaimSchema,
  RecordPaymentSchema,
  RefundPaymentSchema,
  SubmitHmoClaimSchema,
  UpsertServicePriceSchema,
  type CreateInvoiceDto,
  type ReconcileHmoClaimDto,
  type RecordPaymentDto,
  type RefundPaymentDto,
  type SubmitHmoClaimDto,
  type UpsertServicePriceDto,
} from '@healthos/contracts';
import { CurrentUser, RequirePermissions } from '../security/auth.guard.js';
import type { AccessTokenClaims } from '../security/security.module.js';
import { ZodValidationPipe } from '../common/zod-pipe.js';
import { BillingService } from './billing.service.js';

function extractMeta(req: Request) {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

@Controller('v1/billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @RequirePermissions('billing:invoice')
  @Post('services')
  upsertService(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(UpsertServicePriceSchema)) dto: UpsertServicePriceDto,
  ) {
    return this.billing.upsertServicePrice(actor, dto);
  }

  @RequirePermissions('billing:invoice')
  @Post('invoices')
  createInvoice(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(CreateInvoiceSchema)) dto: CreateInvoiceDto,
    @Req() req: Request,
  ) {
    return this.billing.createInvoice(actor, dto, extractMeta(req));
  }

  @RequirePermissions('billing:payment_record')
  @Post('payments')
  recordPayment(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(RecordPaymentSchema)) dto: RecordPaymentDto,
    @Req() req: Request,
  ) {
    return this.billing.recordPayment(actor, dto, extractMeta(req));
  }

  @RequirePermissions('billing:refund')
  @Post('payments/refund')
  refundPayment(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(RefundPaymentSchema)) dto: RefundPaymentDto,
    @Req() req: Request,
  ) {
    return this.billing.refundPayment(actor, dto, extractMeta(req));
  }

  @RequirePermissions('hmo:manage')
  @Post('hmo/claims')
  submitHmoClaim(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(SubmitHmoClaimSchema)) dto: SubmitHmoClaimDto,
    @Req() req: Request,
  ) {
    return this.billing.submitHmoClaim(actor, dto, extractMeta(req));
  }

  @RequirePermissions('hmo:manage')
  @Post('hmo/claims/:id/reconcile')
  reconcileHmoClaim(
    @CurrentUser() actor: AccessTokenClaims,
    @Param('id', ParseUUIDPipe) claimId: string,
    @Body(new ZodValidationPipe(ReconcileHmoClaimSchema)) dto: ReconcileHmoClaimDto,
    @Req() req: Request,
  ) {
    return this.billing.reconcileHmoClaim(actor, claimId, dto, extractMeta(req));
  }

  @RequirePermissions('billing:read')
  @Get('patients/:patientId/statement')
  getStatement(
    @CurrentUser() actor: AccessTokenClaims,
    @Param('patientId', ParseUUIDPipe) patientId: string,
  ) {
    return this.billing.getPatientStatement(actor, patientId);
  }

  @RequirePermissions('finance:reports')
  @Get('reports/departmental-revenue')
  departmentalRevenue(
    @CurrentUser() actor: AccessTokenClaims,
    @Query('branchId') branchId?: string,
  ) {
    return this.billing.getDepartmentalRevenueReport(actor, branchId);
  }
}
