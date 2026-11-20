import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  AssistantQuerySchema,
  CreateTelemedicineSessionSchema,
  KioskCheckInSchema,
  type AssistantQueryDto,
  type CreateTelemedicineSessionDto,
  type KioskCheckInDto,
} from '@healthos/contracts';
import { CurrentUser, RequirePermissions } from '../security/auth.guard.js';
import type { AccessTokenClaims } from '../security/security.module.js';
import { ZodValidationPipe } from '../common/zod-pipe.js';
import { AdvancedService } from './advanced.service.js';

function extractMeta(req: Request) {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

@Controller('v1/advanced')
export class AdvancedController {
  constructor(private readonly advanced: AdvancedService) {}

  @RequirePermissions('analytics:read')
  @Post('assistant/query')
  assistantQuery(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(AssistantQuerySchema)) dto: AssistantQueryDto,
  ) {
    return this.advanced.answerOperationsQuestion(actor, dto);
  }

  @RequirePermissions('appointment:checkin')
  @Post('kiosk/checkin')
  kioskCheckIn(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(KioskCheckInSchema)) dto: KioskCheckInDto,
    @Req() req: Request,
  ) {
    return this.advanced.kioskCheckIn(actor, dto, extractMeta(req));
  }

  @RequirePermissions('consultation:write')
  @Post('telemedicine/sessions')
  createTelemed(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(CreateTelemedicineSessionSchema)) dto: CreateTelemedicineSessionDto,
    @Req() req: Request,
  ) {
    return this.advanced.createTelemedicineSession(actor, dto, extractMeta(req));
  }

  @RequirePermissions('emr:read')
  @Get('fhir/Patient/:id')
  exportFhirPatient(
    @CurrentUser() actor: AccessTokenClaims,
    @Param('id', ParseUUIDPipe) patientId: string,
    @Req() req: Request,
  ) {
    return this.advanced.exportFhirPatient(actor, patientId, extractMeta(req));
  }

  @RequirePermissions('analytics:read')
  @Get('bi/forecast')
  forecast(@CurrentUser() actor: AccessTokenClaims) {
    return this.advanced.getPredictiveForecast(actor);
  }
}
