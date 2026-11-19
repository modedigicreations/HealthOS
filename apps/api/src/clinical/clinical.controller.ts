import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  AdmitPatientSchema,
  BookAppointmentSchema,
  CreateClinicalTemplateSchema,
  CreateConsultationSchema,
  CreateDoctorScheduleSchema,
  CreateWardSchema,
  DischargePatientSchema,
  UpsertDoctorProfileSchema,
  type AdmitPatientDto,
  type BookAppointmentDto,
  type CreateClinicalTemplateDto,
  type CreateConsultationDto,
  type CreateDoctorScheduleDto,
  type CreateWardDto,
  type DischargePatientDto,
  type UpsertDoctorProfileDto,
} from '@healthos/contracts';
import { CurrentUser, RequirePermissions } from '../security/auth.guard.js';
import type { AccessTokenClaims } from '../security/security.module.js';
import { ZodValidationPipe } from '../common/zod-pipe.js';
import { ClinicalService } from './clinical.service.js';

function extractMeta(req: Request) {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

@Controller('v1/clinical')
export class ClinicalController {
  constructor(private readonly clinical: ClinicalService) {}

  @RequirePermissions('hr:manage')
  @Post('doctors/profile')
  upsertDoctorProfile(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(UpsertDoctorProfileSchema)) dto: UpsertDoctorProfileDto,
    @Req() req: Request,
  ) {
    return this.clinical.upsertDoctorProfile(actor, dto, extractMeta(req));
  }

  @RequirePermissions('roster:manage')
  @Post('doctors/schedules')
  createSchedule(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(CreateDoctorScheduleSchema)) dto: CreateDoctorScheduleDto,
  ) {
    return this.clinical.createDoctorSchedule(actor, dto);
  }

  @RequirePermissions('appointment:book')
  @Post('appointments')
  bookAppointment(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(BookAppointmentSchema)) dto: BookAppointmentDto,
    @Req() req: Request,
  ) {
    return this.clinical.bookAppointment(actor, dto, extractMeta(req));
  }

  @RequirePermissions('appointment:checkin')
  @Post('appointments/:id/checkin')
  checkIn(
    @CurrentUser() actor: AccessTokenClaims,
    @Param('id', ParseUUIDPipe) appointmentId: string,
    @Req() req: Request,
  ) {
    return this.clinical.checkInAppointment(actor, appointmentId, extractMeta(req));
  }

  @RequirePermissions('appointment:read')
  @Get('branches/:branchId/queue')
  getQueue(
    @CurrentUser() actor: AccessTokenClaims,
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.clinical.getBranchQueue(actor, branchId);
  }

  @RequirePermissions('consultation:write')
  @Post('templates')
  createTemplate(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(CreateClinicalTemplateSchema)) dto: CreateClinicalTemplateDto,
  ) {
    return this.clinical.createClinicalTemplate(actor, dto);
  }

  @RequirePermissions('consultation:write')
  @Post('consultations')
  createConsultation(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(CreateConsultationSchema)) dto: CreateConsultationDto,
    @Req() req: Request,
  ) {
    return this.clinical.createConsultation(actor, dto, extractMeta(req));
  }

  @RequirePermissions('consultation:read')
  @Get('patients/:patientId/consultations')
  getPatientConsultations(
    @CurrentUser() actor: AccessTokenClaims,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Req() req: Request,
  ) {
    return this.clinical.getPatientConsultations(actor, patientId, extractMeta(req));
  }

  @RequirePermissions('ward:manage')
  @Post('wards')
  createWard(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(CreateWardSchema)) dto: CreateWardDto,
  ) {
    return this.clinical.createWard(actor, dto);
  }

  @RequirePermissions('ward:manage')
  @Post('admissions')
  admitPatient(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(AdmitPatientSchema)) dto: AdmitPatientDto,
    @Req() req: Request,
  ) {
    return this.clinical.admitPatient(actor, dto, extractMeta(req));
  }

  @RequirePermissions('ward:manage')
  @Post('admissions/:id/discharge')
  dischargePatient(
    @CurrentUser() actor: AccessTokenClaims,
    @Param('id', ParseUUIDPipe) admissionId: string,
    @Body(new ZodValidationPipe(DischargePatientSchema)) dto: DischargePatientDto,
    @Req() req: Request,
  ) {
    return this.clinical.dischargePatient(actor, admissionId, dto, extractMeta(req));
  }

  @RequirePermissions('analytics:read')
  @Get('reports/doctor-performance')
  doctorPerformance(
    @CurrentUser() actor: AccessTokenClaims,
    @Query('branchId') branchId?: string,
  ) {
    return this.clinical.getDoctorPerformanceReport(actor, branchId);
  }
}
