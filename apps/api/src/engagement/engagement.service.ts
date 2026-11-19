import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import type {
  CreateAnnouncementDto,
  SendNotificationDto,
  SendSecureMessageDto,
  SubmitSurveyDto,
} from '@healthos/contracts';
import {
  healthAnnouncements,
  patientNotifications,
  patientSurveys,
  secureMessages,
  withTenantContext,
} from '@healthos/db';
import { AuditService } from '../audit/audit.service.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { CryptoService, DbService, type AccessTokenClaims } from '../security/security.module.js';

@Injectable()
export class EngagementService {
  constructor(
    private readonly dbService: DbService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  async sendNotification(actor: AccessTokenClaims, dto: SendNotificationDto, meta: RequestMeta) {
    const notificationId = randomUUID();
    const messageEncrypted = await this.crypto.cipher.encryptString(dto.message, {
      organizationId: actor.orgId,
      tableName: 'patient_notifications',
      recordId: notificationId,
      fieldName: 'message',
    });

    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(patientNotifications).values({
          id: notificationId,
          organizationId: actor.orgId,
          branchId: dto.branchId,
          patientId: dto.patientId,
          channel: dto.channel,
          notificationType: dto.notificationType,
          messageEncrypted,
          status: 'QUEUED',
        });
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: dto.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'PATIENT_NOTIFICATION_QUEUED',
      resourceType: 'patient_notification',
      resourceId: notificationId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { channel: dto.channel, notificationType: dto.notificationType },
    });

    return { notificationId, status: 'QUEUED' };
  }

  async sendSecureMessage(actor: AccessTokenClaims, dto: SendSecureMessageDto, meta: RequestMeta) {
    const messageId = randomUUID();
    const payloadEncrypted = await this.crypto.cipher.encryptJson(
      { subject: dto.subject, body: dto.body },
      {
        organizationId: actor.orgId,
        tableName: 'secure_messages',
        recordId: messageId,
        fieldName: 'payload',
      },
    );

    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(secureMessages).values({
          id: messageId,
          organizationId: actor.orgId,
          branchId: dto.branchId,
          patientId: dto.patientId,
          senderUserId: actor.sub,
          recipientUserId: dto.recipientUserId,
          payloadEncrypted,
        });
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: dto.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'SECURE_MESSAGE_SENT',
      resourceType: 'secure_message',
      resourceId: messageId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { patientId: dto.patientId, recipientUserId: dto.recipientUserId },
    });

    return { messageId };
  }

  async getPatientMessages(actor: AccessTokenClaims, patientId: string) {
    const rows = await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        return tx
          .select()
          .from(secureMessages)
          .where(
            and(
              eq(secureMessages.organizationId, actor.orgId),
              eq(secureMessages.patientId, patientId),
            ),
          )
          .orderBy(desc(secureMessages.sentAt))
          .limit(50);
      },
    );

    return Promise.all(
      rows.map(async (m) => ({
        id: m.id,
        senderUserId: m.senderUserId,
        recipientUserId: m.recipientUserId,
        sentAt: m.sentAt,
        payload: await this.crypto.cipher.decryptJson<{ subject: string; body: string }>(
          m.payloadEncrypted,
          {
            organizationId: actor.orgId,
            tableName: 'secure_messages',
            recordId: m.id,
            fieldName: 'payload',
          },
        ),
      })),
    );
  }

  async submitSurvey(actor: AccessTokenClaims, dto: SubmitSurveyDto) {
    const surveyId = randomUUID();
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(patientSurveys).values({
          id: surveyId,
          organizationId: actor.orgId,
          branchId: dto.branchId,
          patientId: dto.patientId,
          rating: dto.rating,
          feedback: dto.feedback ?? null,
        });
      },
    );
    return { surveyId };
  }

  async publishAnnouncement(actor: AccessTokenClaims, dto: CreateAnnouncementDto) {
    const announcementId = randomUUID();
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId ?? actor.branchId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(healthAnnouncements).values({
          id: announcementId,
          organizationId: actor.orgId,
          branchId: dto.branchId ?? null,
          title: dto.title,
          body: dto.body,
          publishedByUserId: actor.sub,
        });
      },
    );
    return { announcementId };
  }
}
