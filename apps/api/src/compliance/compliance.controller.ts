import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  CreateCapaSchema,
  CreateComplianceChecklistSchema,
  CreateSopSchema,
  RecordFacilityLicenceSchema,
  ReportIncidentSchema,
  UpdateCapaStatusSchema,
  type CreateCapaDto,
  type CreateComplianceChecklistDto,
  type CreateSopDto,
  type RecordFacilityLicenceDto,
  type ReportIncidentDto,
  type UpdateCapaStatusDto,
} from '@healthos/contracts';
import { CurrentUser, RequirePermissions } from '../security/auth.guard.js';
import type { AccessTokenClaims } from '../security/security.module.js';
import { ZodValidationPipe } from '../common/zod-pipe.js';
import { ComplianceService } from './compliance.service.js';

function extractMeta(req: Request) {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

@Controller('v1/compliance')
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @RequirePermissions('compliance:manage')
  @Post('checklists')
  createChecklist(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(CreateComplianceChecklistSchema)) dto: CreateComplianceChecklistDto,
  ) {
    return this.compliance.createChecklist(actor, dto);
  }

  @RequirePermissions('compliance:manage')
  @Post('licences')
  recordLicence(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(RecordFacilityLicenceSchema)) dto: RecordFacilityLicenceDto,
    @Req() req: Request,
  ) {
    return this.compliance.recordFacilityLicence(actor, dto, extractMeta(req));
  }

  @RequirePermissions('compliance:read')
  @Get('licences/expiring')
  expiringLicences(@CurrentUser() actor: AccessTokenClaims, @Query('days') days?: string) {
    return this.compliance.getExpiringFacilityLicences(actor, days ? Number(days) : 60);
  }

  @RequirePermissions('compliance:manage')
  @Post('sops')
  publishSop(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(CreateSopSchema)) dto: CreateSopDto,
  ) {
    return this.compliance.publishSop(actor, dto);
  }

  @RequirePermissions('incident:report')
  @Post('incidents')
  reportIncident(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(ReportIncidentSchema)) dto: ReportIncidentDto,
    @Req() req: Request,
  ) {
    return this.compliance.reportIncident(actor, dto, extractMeta(req));
  }

  @RequirePermissions('compliance:manage')
  @Post('capa')
  createCapa(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(CreateCapaSchema)) dto: CreateCapaDto,
  ) {
    return this.compliance.createCapa(actor, dto);
  }

  @RequirePermissions('compliance:manage')
  @Patch('capa/:id')
  updateCapa(
    @CurrentUser() actor: AccessTokenClaims,
    @Param('id', ParseUUIDPipe) capaId: string,
    @Body(new ZodValidationPipe(UpdateCapaStatusSchema)) dto: UpdateCapaStatusDto,
    @Req() req: Request,
  ) {
    return this.compliance.updateCapaStatus(actor, capaId, dto, extractMeta(req));
  }

  @RequirePermissions('audit:read')
  @Get('audit-chain/verify')
  verifyAuditChain(@CurrentUser() actor: AccessTokenClaims) {
    return this.compliance.verifyAuditChain(actor);
  }
}
