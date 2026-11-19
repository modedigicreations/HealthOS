import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  CreateMaintenanceTicketSchema,
  RecordEquipmentServiceSchema,
  RegisterEquipmentSchema,
  UpdateMaintenanceTicketSchema,
  type CreateMaintenanceTicketDto,
  type RecordEquipmentServiceDto,
  type RegisterEquipmentDto,
  type UpdateMaintenanceTicketDto,
} from '@healthos/contracts';
import { CurrentUser, RequirePermissions } from '../security/auth.guard.js';
import type { AccessTokenClaims } from '../security/security.module.js';
import { ZodValidationPipe } from '../common/zod-pipe.js';
import { EquipmentService } from './equipment.service.js';

function extractMeta(req: Request) {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

@Controller('v1/equipment')
export class EquipmentController {
  constructor(private readonly equipment: EquipmentService) {}

  @RequirePermissions('equipment:manage')
  @Post('assets')
  register(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(RegisterEquipmentSchema)) dto: RegisterEquipmentDto,
    @Req() req: Request,
  ) {
    return this.equipment.registerEquipment(actor, dto, extractMeta(req));
  }

  @RequirePermissions('equipment:manage')
  @Post('service-logs')
  recordService(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(RecordEquipmentServiceSchema)) dto: RecordEquipmentServiceDto,
    @Req() req: Request,
  ) {
    return this.equipment.recordService(actor, dto, extractMeta(req));
  }

  @RequirePermissions('equipment:read')
  @Post('tickets')
  createTicket(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(CreateMaintenanceTicketSchema)) dto: CreateMaintenanceTicketDto,
  ) {
    return this.equipment.createTicket(actor, dto);
  }

  @RequirePermissions('equipment:manage')
  @Patch('tickets/:id')
  updateTicket(
    @CurrentUser() actor: AccessTokenClaims,
    @Param('id', ParseUUIDPipe) ticketId: string,
    @Body(new ZodValidationPipe(UpdateMaintenanceTicketSchema)) dto: UpdateMaintenanceTicketDto,
  ) {
    return this.equipment.updateTicket(actor, ticketId, dto);
  }

  @RequirePermissions('analytics:read')
  @Get('reports/downtime-cost')
  downtimeReport(@CurrentUser() actor: AccessTokenClaims) {
    return this.equipment.getMaintenanceCostAndDowntimeReport(actor);
  }
}
