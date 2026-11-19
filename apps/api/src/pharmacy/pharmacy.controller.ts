import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  AdjustStockSchema,
  CreateInventoryItemSchema,
  DispensePrescriptionSchema,
  ReceiveInventoryBatchSchema,
  TransferStockSchema,
  type AdjustStockDto,
  type CreateInventoryItemDto,
  type DispensePrescriptionDto,
  type ReceiveInventoryBatchDto,
  type TransferStockDto,
} from '@healthos/contracts';
import { CurrentUser, RequirePermissions } from '../security/auth.guard.js';
import type { AccessTokenClaims } from '../security/security.module.js';
import { ZodValidationPipe } from '../common/zod-pipe.js';
import { PharmacyService } from './pharmacy.service.js';

function extractMeta(req: Request) {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

@Controller('v1/pharmacy')
export class PharmacyController {
  constructor(private readonly pharmacy: PharmacyService) {}

  @RequirePermissions('inventory:adjust')
  @Post('items')
  createItem(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(CreateInventoryItemSchema)) dto: CreateInventoryItemDto,
  ) {
    return this.pharmacy.createItem(actor, dto);
  }

  @RequirePermissions('inventory:read')
  @Get('items')
  listItems(@CurrentUser() actor: AccessTokenClaims) {
    return this.pharmacy.listItems(actor);
  }

  @RequirePermissions('inventory:adjust')
  @Post('batches')
  receiveBatch(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(ReceiveInventoryBatchSchema)) dto: ReceiveInventoryBatchDto,
    @Req() req: Request,
  ) {
    return this.pharmacy.receiveBatch(actor, dto, extractMeta(req));
  }

  @RequirePermissions('pharmacy:dispense')
  @Post('dispense')
  dispense(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(DispensePrescriptionSchema)) dto: DispensePrescriptionDto,
    @Req() req: Request,
  ) {
    return this.pharmacy.dispenseMedication(actor, dto, extractMeta(req));
  }

  @RequirePermissions('inventory:transfer')
  @Post('transfer')
  transfer(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(TransferStockSchema)) dto: TransferStockDto,
    @Req() req: Request,
  ) {
    return this.pharmacy.transferStock(actor, dto, extractMeta(req));
  }

  @RequirePermissions('inventory:adjust')
  @Post('adjust')
  adjust(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(AdjustStockSchema)) dto: AdjustStockDto,
    @Req() req: Request,
  ) {
    return this.pharmacy.adjustStock(actor, dto, extractMeta(req));
  }

  @RequirePermissions('inventory:read')
  @Get('branches/:branchId/alerts')
  alerts(
    @CurrentUser() actor: AccessTokenClaims,
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.pharmacy.getInventoryAlerts(actor, branchId);
  }

  @RequirePermissions('analytics:read')
  @Get('reports/valuation')
  valuation(
    @CurrentUser() actor: AccessTokenClaims,
    @Query('branchId') branchId?: string,
  ) {
    return this.pharmacy.getValuationReport(actor, branchId);
  }
}
