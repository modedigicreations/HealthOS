import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNull, lte } from 'drizzle-orm';
import type {
  AssignStaffTaskDto,
  ClockAttendanceDto,
  CreateShiftDto,
  DecideLeaveDto,
  RecordStaffLicenceDto,
  RequestLeaveDto,
  UpsertStaffProfileDto,
} from '@healthos/contracts';
import {
  staffAttendance,
  staffLeaves,
  staffLicences,
  staffProfiles,
  staffShifts,
  staffTasks,
  withTenantContext,
} from '@healthos/db';
import { AuditService } from '../audit/audit.service.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { CryptoService, DbService, type AccessTokenClaims } from '../security/security.module.js';

@Injectable()
export class HrService {
  constructor(
    private readonly dbService: DbService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  async upsertProfile(actor: AccessTokenClaims, dto: UpsertStaffProfileDto, meta: RequestMeta) {
    const profileId = randomUUID();
    const contactEncrypted = await this.crypto.cipher.encryptJson(
      { phone: dto.phone, emergencyContact: dto.emergencyContact ?? null },
      {
        organizationId: actor.orgId,
        tableName: 'staff_profiles',
        recordId: dto.userId,
        fieldName: 'contact',
      },
    );

    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        await tx
          .insert(staffProfiles)
          .values({
            id: profileId,
            organizationId: actor.orgId,
            branchId: dto.branchId,
            userId: dto.userId,
            employeeCode: dto.employeeCode.toUpperCase(),
            department: dto.department,
            designation: dto.designation,
            contactEncrypted,
          })
          .onConflictDoUpdate({
            target: [staffProfiles.organizationId, staffProfiles.userId],
            set: {
              branchId: dto.branchId,
              department: dto.department,
              designation: dto.designation,
              contactEncrypted,
              updatedAt: new Date(),
            },
          });
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: dto.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'HR_STAFF_PROFILE_UPSERTED',
      resourceType: 'staff_profile',
      resourceId: dto.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { department: dto.department, designation: dto.designation },
    });

    return { userId: dto.userId, employeeCode: dto.employeeCode.toUpperCase() };
  }

  async recordLicence(actor: AccessTokenClaims, dto: RecordStaffLicenceDto, meta: RequestMeta) {
    const licenceId = randomUUID();
    const licenceNumberEncrypted = await this.crypto.cipher.encryptString(dto.licenceNumber, {
      organizationId: actor.orgId,
      tableName: 'staff_licences',
      recordId: licenceId,
      fieldName: 'licence_number',
    });

    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(staffLicences).values({
          id: licenceId,
          organizationId: actor.orgId,
          userId: dto.userId,
          licenceType: dto.licenceType,
          issuingBody: dto.issuingBody,
          licenceNumberEncrypted,
          issuedAt: new Date(dto.issuedAt),
          expiresAt: new Date(dto.expiresAt),
        });
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: actor.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'HR_LICENCE_RECORDED',
      resourceType: 'staff_licence',
      resourceId: licenceId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { userId: dto.userId, licenceType: dto.licenceType },
    });

    return { licenceId, expiresAt: dto.expiresAt };
  }

  async getExpiringLicences(actor: AccessTokenClaims, withinDays = 60) {
    const cutoff = new Date(Date.now() + withinDays * 86_400_000);
    return withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        return tx
          .select({
            id: staffLicences.id,
            userId: staffLicences.userId,
            licenceType: staffLicences.licenceType,
            issuingBody: staffLicences.issuingBody,
            expiresAt: staffLicences.expiresAt,
          })
          .from(staffLicences)
          .where(
            and(
              eq(staffLicences.organizationId, actor.orgId),
              lte(staffLicences.expiresAt, cutoff),
            ),
          );
      },
    );
  }

  async createShift(actor: AccessTokenClaims, dto: CreateShiftDto) {
    const shiftId = randomUUID();
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(staffShifts).values({
          id: shiftId,
          organizationId: actor.orgId,
          branchId: dto.branchId,
          userId: dto.userId,
          department: dto.department,
          shiftType: dto.shiftType,
          startsAt: new Date(dto.startsAt),
          endsAt: new Date(dto.endsAt),
        });
      },
    );
    return { shiftId };
  }

  async clockAttendance(actor: AccessTokenClaims, dto: ClockAttendanceDto) {
    return withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        if (dto.action === 'CLOCK_IN') {
          const attendanceId = randomUUID();
          await tx.insert(staffAttendance).values({
            id: attendanceId,
            organizationId: actor.orgId,
            branchId: dto.branchId,
            userId: actor.sub,
            shiftId: dto.shiftId ?? null,
          });
          return { attendanceId, action: 'CLOCK_IN' };
        }

        const [open] = await tx
          .select()
          .from(staffAttendance)
          .where(
            and(
              eq(staffAttendance.organizationId, actor.orgId),
              eq(staffAttendance.userId, actor.sub),
              isNull(staffAttendance.clockOutAt),
            ),
          )
          .orderBy(desc(staffAttendance.clockInAt))
          .limit(1);

        if (!open) throw new NotFoundException('No active clock-in found.');
        await tx
          .update(staffAttendance)
          .set({ clockOutAt: new Date() })
          .where(eq(staffAttendance.id, open.id));

        return { attendanceId: open.id, action: 'CLOCK_OUT' };
      },
    );
  }

  async requestLeave(actor: AccessTokenClaims, dto: RequestLeaveDto) {
    const leaveId = randomUUID();
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(staffLeaves).values({
          id: leaveId,
          organizationId: actor.orgId,
          userId: actor.sub,
          leaveType: dto.leaveType,
          startsAt: new Date(dto.startsAt),
          endsAt: new Date(dto.endsAt),
          reason: dto.reason,
        });
      },
    );
    return { leaveId, status: 'PENDING' };
  }

  async decideLeave(actor: AccessTokenClaims, leaveId: string, dto: DecideLeaveDto, meta: RequestMeta) {
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        await tx
          .update(staffLeaves)
          .set({ status: dto.status, decidedByUserId: actor.sub })
          .where(and(eq(staffLeaves.id, leaveId), eq(staffLeaves.organizationId, actor.orgId)));
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: actor.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'HR_LEAVE_DECIDED',
      resourceType: 'staff_leave',
      resourceId: leaveId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { status: dto.status },
    });

    return { leaveId, status: dto.status };
  }

  async assignTask(actor: AccessTokenClaims, dto: AssignStaffTaskDto) {
    const taskId = randomUUID();
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(staffTasks).values({
          id: taskId,
          organizationId: actor.orgId,
          branchId: dto.branchId,
          assignedToUserId: dto.assignedToUserId,
          assignedByUserId: actor.sub,
          title: dto.title,
          description: dto.description ?? null,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        });
      },
    );
    return { taskId, status: 'OPEN' };
  }
}
