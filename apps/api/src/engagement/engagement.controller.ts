import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  CreateAnnouncementSchema,
  SendNotificationSchema,
  SendSecureMessageSchema,
  SubmitSurveySchema,
  type CreateAnnouncementDto,
  type SendNotificationDto,
  type SendSecureMessageDto,
  type SubmitSurveyDto,
} from '@healthos/contracts';
import { CurrentUser, RequirePermissions } from '../security/auth.guard.js';
import type { AccessTokenClaims } from '../security/security.module.js';
import { ZodValidationPipe } from '../common/zod-pipe.js';
import { EngagementService } from './engagement.service.js';

function extractMeta(req: Request) {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

@Controller('v1/engagement')
export class EngagementController {
  constructor(private readonly engagement: EngagementService) {}

  @RequirePermissions('engagement:communicate')
  @Post('notifications')
  sendNotification(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(SendNotificationSchema)) dto: SendNotificationDto,
    @Req() req: Request,
  ) {
    return this.engagement.sendNotification(actor, dto, extractMeta(req));
  }

  @RequirePermissions('engagement:communicate')
  @Post('messages')
  sendMessage(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(SendSecureMessageSchema)) dto: SendSecureMessageDto,
    @Req() req: Request,
  ) {
    return this.engagement.sendSecureMessage(actor, dto, extractMeta(req));
  }

  @RequirePermissions('engagement:communicate')
  @Get('patients/:patientId/messages')
  getMessages(
    @CurrentUser() actor: AccessTokenClaims,
    @Param('patientId', ParseUUIDPipe) patientId: string,
  ) {
    return this.engagement.getPatientMessages(actor, patientId);
  }

  @RequirePermissions('engagement:communicate')
  @Post('surveys')
  submitSurvey(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(SubmitSurveySchema)) dto: SubmitSurveyDto,
  ) {
    return this.engagement.submitSurvey(actor, dto);
  }

  @RequirePermissions('engagement:communicate')
  @Post('announcements')
  publishAnnouncement(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(CreateAnnouncementSchema)) dto: CreateAnnouncementDto,
  ) {
    return this.engagement.publishAnnouncement(actor, dto);
  }
}
