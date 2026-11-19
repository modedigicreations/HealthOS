import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  BreakGlassAccessSchema,
  CreateReferralSchema,
  MergePatientsSchema,
  RecordAllergySchema,
  RecordMedicationHistorySchema,
  RecordVitalsSchema,
  RegisterPatientSchema,
  SearchPatientSchema,
  UpdateConsentSchema,
  type BreakGlassAccessDto,
  type CreateReferralDto,
  type MergePatientsDto,
  type RecordAllergyDto,
  type RecordMedicationHistoryDto,
  type RecordVitalsDto,
  type RegisterPatientDto,
  type SearchPatientDto,
  type UpdateConsentDto,
} from '@healthos/contracts';
import { CurrentUser, RequirePermissions } from '../security/auth.guard.js';
import type { AccessTokenClaims } from '../security/security.module.js';
import { ZodValidationPipe } from '../common/zod-pipe.js';
import { PatientsService } from './patients.service.js';

function extractMeta(req: Request) {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

@Controller('v1/patients')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @RequirePermissions('patient:create')
  @Post()
  register(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(RegisterPatientSchema)) dto: RegisterPatientDto,
    @Req() req: Request,
  ) {
    return this.patients.registerPatient(actor, dto, extractMeta(req));
  }

  @RequirePermissions('patient:read')
  @Get('search')
  search(
    @CurrentUser() actor: AccessTokenClaims,
    @Query(new ZodValidationPipe(SearchPatientSchema)) query: SearchPatientDto,
    @Req() req: Request,
  ) {
    return this.patients.searchPatients(actor, query, extractMeta(req));
  }

  @RequirePermissions('emr:read')
  @Get(':id/emr')
  getEmr(
    @CurrentUser() actor: AccessTokenClaims,
    @Param('id', ParseUUIDPipe) patientId: string,
    @Query('department') department: string | undefined,
    @Req() req: Request,
  ) {
    return this.patients.getPatientEmr(actor, patientId, extractMeta(req), { department });
  }

  @RequirePermissions('emr:read', 'emr:break_glass')
  @Post(':id/emr/break-glass')
  breakGlassEmr(
    @CurrentUser() actor: AccessTokenClaims,
    @Param('id', ParseUUIDPipe) patientId: string,
    @Query('department') department: string | undefined,
    @Body(new ZodValidationPipe(BreakGlassAccessSchema)) dto: BreakGlassAccessDto,
    @Req() req: Request,
  ) {
    return this.patients.getPatientEmr(actor, patientId, extractMeta(req), {
      department,
      breakGlassReason: dto.reason,
    });
  }

  @RequirePermissions('emr:write')
  @Post(':id/vitals')
  recordVitals(
    @CurrentUser() actor: AccessTokenClaims,
    @Param('id', ParseUUIDPipe) patientId: string,
    @Body(new ZodValidationPipe(RecordVitalsSchema)) dto: RecordVitalsDto,
    @Req() req: Request,
  ) {
    return this.patients.recordVitals(actor, patientId, dto, extractMeta(req));
  }

  @RequirePermissions('emr:write')
  @Post(':id/allergies')
  recordAllergy(
    @CurrentUser() actor: AccessTokenClaims,
    @Param('id', ParseUUIDPipe) patientId: string,
    @Body(new ZodValidationPipe(RecordAllergySchema)) dto: RecordAllergyDto,
    @Req() req: Request,
  ) {
    return this.patients.recordAllergy(actor, patientId, dto, extractMeta(req));
  }

  @RequirePermissions('emr:write')
  @Post(':id/medications')
  recordMedication(
    @CurrentUser() actor: AccessTokenClaims,
    @Param('id', ParseUUIDPipe) patientId: string,
    @Body(new ZodValidationPipe(RecordMedicationHistorySchema)) dto: RecordMedicationHistoryDto,
    @Req() req: Request,
  ) {
    return this.patients.recordMedicationHistory(actor, patientId, dto, extractMeta(req));
  }

  @RequirePermissions('emr:consent_manage')
  @Post(':id/consents')
  updateConsent(
    @CurrentUser() actor: AccessTokenClaims,
    @Param('id', ParseUUIDPipe) patientId: string,
    @Body(new ZodValidationPipe(UpdateConsentSchema)) dto: UpdateConsentDto,
    @Req() req: Request,
  ) {
    return this.patients.updateConsent(actor, patientId, dto, extractMeta(req));
  }

  @RequirePermissions('emr:write')
  @Post(':id/referrals')
  createReferral(
    @CurrentUser() actor: AccessTokenClaims,
    @Param('id', ParseUUIDPipe) patientId: string,
    @Body(new ZodValidationPipe(CreateReferralSchema)) dto: CreateReferralDto,
    @Req() req: Request,
  ) {
    return this.patients.createReferral(actor, patientId, dto, extractMeta(req));
  }

  @RequirePermissions('patient:merge')
  @Post('merge')
  mergeDuplicates(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(MergePatientsSchema)) dto: MergePatientsDto,
    @Req() req: Request,
  ) {
    return this.patients.mergeDuplicatePatients(actor, dto, extractMeta(req));
  }
}
