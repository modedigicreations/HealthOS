import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  AssignStaffTaskSchema,
  ClockAttendanceSchema,
  CreateShiftSchema,
  DecideLeaveSchema,
  RecordStaffLicenceSchema,
  RequestLeaveSchema,
  UpsertStaffProfileSchema,
  type AssignStaffTaskDto,
  type ClockAttendanceDto,
  type CreateShiftDto,
  type DecideLeaveDto,
  type RecordStaffLicenceDto,
  type RequestLeaveDto,
  type UpsertStaffProfileDto,
} from '@healthos/contracts';
import { CurrentUser, RequirePermissions } from '../security/auth.guard.js';
import type { AccessTokenClaims } from '../security/security.module.js';
import { ZodValidationPipe } from '../common/zod-pipe.js';
import { HrService } from './hr.service.js';

function extractMeta(req: Request) {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

@Controller('v1/hr')
export class HrController {
  constructor(private readonly hr: HrService) {}

  @RequirePermissions('hr:manage')
  @Post('profiles')
  upsertProfile(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(UpsertStaffProfileSchema)) dto: UpsertStaffProfileDto,
    @Req() req: Request,
  ) {
    return this.hr.upsertProfile(actor, dto, extractMeta(req));
  }

  @RequirePermissions('hr:manage')
  @Post('licences')
  recordLicence(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(RecordStaffLicenceSchema)) dto: RecordStaffLicenceDto,
    @Req() req: Request,
  ) {
    return this.hr.recordLicence(actor, dto, extractMeta(req));
  }

  @RequirePermissions('hr:read')
  @Get('licences/expiring')
  expiringLicences(@CurrentUser() actor: AccessTokenClaims, @Query('days') days?: string) {
    return this.hr.getExpiringLicences(actor, days ? Number(days) : 60);
  }

  @RequirePermissions('roster:manage')
  @Post('shifts')
  createShift(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(CreateShiftSchema)) dto: CreateShiftDto,
  ) {
    return this.hr.createShift(actor, dto);
  }

  @Post('attendance')
  clockAttendance(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(ClockAttendanceSchema)) dto: ClockAttendanceDto,
  ) {
    return this.hr.clockAttendance(actor, dto);
  }

  @Post('leaves')
  requestLeave(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(RequestLeaveSchema)) dto: RequestLeaveDto,
  ) {
    return this.hr.requestLeave(actor, dto);
  }

  @RequirePermissions('hr:manage')
  @Post('leaves/:id/decide')
  decideLeave(
    @CurrentUser() actor: AccessTokenClaims,
    @Param('id', ParseUUIDPipe) leaveId: string,
    @Body(new ZodValidationPipe(DecideLeaveSchema)) dto: DecideLeaveDto,
    @Req() req: Request,
  ) {
    return this.hr.decideLeave(actor, leaveId, dto, extractMeta(req));
  }

  @RequirePermissions('roster:manage')
  @Post('tasks')
  assignTask(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(AssignStaffTaskSchema)) dto: AssignStaffTaskDto,
  ) {
    return this.hr.assignTask(actor, dto);
  }
}
