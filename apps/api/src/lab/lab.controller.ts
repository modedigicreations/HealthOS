import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  CreateLabOrderSchema,
  CreateLabTestSchema,
  EnterLabResultSchema,
  RecordLabQcSchema,
  RegisterSampleSchema,
  UpdateSampleStatusSchema,
  UpsertLabReagentSchema,
  type CreateLabOrderDto,
  type CreateLabTestDto,
  type EnterLabResultDto,
  type RecordLabQcDto,
  type RegisterSampleDto,
  type UpdateSampleStatusDto,
  type UpsertLabReagentDto,
} from '@healthos/contracts';
import { CurrentUser, RequirePermissions } from '../security/auth.guard.js';
import type { AccessTokenClaims } from '../security/security.module.js';
import { ZodValidationPipe } from '../common/zod-pipe.js';
import { LabService } from './lab.service.js';

function extractMeta(req: Request) {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

@Controller('v1/lab')
export class LabController {
  constructor(private readonly lab: LabService) {}

  @RequirePermissions('lab:qc_manage')
  @Post('tests')
  createTest(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(CreateLabTestSchema)) dto: CreateLabTestDto,
  ) {
    return this.lab.createTest(actor, dto);
  }

  @RequirePermissions('lab:order')
  @Get('tests')
  listTests(@CurrentUser() actor: AccessTokenClaims) {
    return this.lab.listTests(actor);
  }

  @RequirePermissions('lab:order')
  @Post('orders')
  createOrder(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(CreateLabOrderSchema)) dto: CreateLabOrderDto,
    @Req() req: Request,
  ) {
    return this.lab.createOrder(actor, dto, extractMeta(req));
  }

  @RequirePermissions('lab:sample_collect')
  @Post('samples')
  registerSample(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(RegisterSampleSchema)) dto: RegisterSampleDto,
    @Req() req: Request,
  ) {
    return this.lab.registerSample(actor, dto, extractMeta(req));
  }

  @RequirePermissions('lab:sample_collect')
  @Patch('samples/:id/status')
  updateSampleStatus(
    @CurrentUser() actor: AccessTokenClaims,
    @Param('id', ParseUUIDPipe) sampleId: string,
    @Body(new ZodValidationPipe(UpdateSampleStatusSchema)) dto: UpdateSampleStatusDto,
    @Req() req: Request,
  ) {
    return this.lab.updateSampleStatus(actor, sampleId, dto, extractMeta(req));
  }

  @RequirePermissions('lab:result_enter')
  @Post('results')
  enterResult(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(EnterLabResultSchema)) dto: EnterLabResultDto,
    @Req() req: Request,
  ) {
    return this.lab.enterResult(actor, dto, extractMeta(req));
  }

  @RequirePermissions('lab:result_authorize')
  @Post('results/:id/authorize')
  authorizeResult(
    @CurrentUser() actor: AccessTokenClaims,
    @Param('id', ParseUUIDPipe) resultId: string,
    @Req() req: Request,
  ) {
    return this.lab.authorizeResult(actor, resultId, extractMeta(req));
  }

  @RequirePermissions('patient:read')
  @Get('patients/:patientId/results')
  getPatientResults(
    @CurrentUser() actor: AccessTokenClaims,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Req() req: Request,
  ) {
    return this.lab.getPatientLabResults(actor, patientId, extractMeta(req));
  }

  @RequirePermissions('lab:qc_manage')
  @Post('qc')
  recordQc(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(RecordLabQcSchema)) dto: RecordLabQcDto,
  ) {
    return this.lab.recordQc(actor, dto);
  }

  @RequirePermissions('lab:qc_manage')
  @Post('reagents')
  upsertReagent(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(UpsertLabReagentSchema)) dto: UpsertLabReagentDto,
  ) {
    return this.lab.upsertReagent(actor, dto);
  }

  @RequirePermissions('analytics:read')
  @Get('reports/performance')
  getPerformance(
    @CurrentUser() actor: AccessTokenClaims,
    @Query('branchId') branchId?: string,
  ) {
    return this.lab.getLabPerformanceReport(actor, branchId);
  }
}
