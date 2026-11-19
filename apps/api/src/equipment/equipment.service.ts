import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import type {
  CreateMaintenanceTicketDto,
  RecordEquipmentServiceDto,
  RegisterEquipmentDto,
  UpdateMaintenanceTicketDto,
} from '@healthos/contracts';
import {
  equipmentAssets,
  equipmentServiceLogs,
  maintenanceTickets,
  withTenantContext,
} from '@healthos/db';
import { AuditService } from '../audit/audit.service.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { DbService, type AccessTokenClaims } from '../security/security.module.js';

@Injectable()
export class EquipmentService {
  constructor(
    private readonly dbService: DbService,
    private readonly audit: AuditService,
  ) {}

  async registerEquipment(actor: AccessTokenClaims, dto: RegisterEquipmentDto, meta: RequestMeta) {
    const equipmentId = randomUUID();
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(equipmentAssets).values({
          id: equipmentId,
          organizationId: actor.orgId,
          branchId: dto.branchId,
          assetTag: dto.assetTag.toUpperCase(),
          name: dto.name,
          serialNumber: dto.serialNumber ?? null,
          department: dto.department,
          nextPreventiveMaintenanceAt: dto.nextPreventiveMaintenanceAt
            ? new Date(dto.nextPreventiveMaintenanceAt)
            : null,
          nextCalibrationAt: dto.nextCalibrationAt ? new Date(dto.nextCalibrationAt) : null,
        });
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: dto.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'EQUIPMENT_REGISTERED',
      resourceType: 'equipment_asset',
      resourceId: equipmentId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { assetTag: dto.assetTag.toUpperCase(), department: dto.department },
    });

    return { equipmentId, assetTag: dto.assetTag.toUpperCase() };
  }

  async recordService(actor: AccessTokenClaims, dto: RecordEquipmentServiceDto, meta: RequestMeta) {
    const logId = randomUUID();
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        const [eqItem] = await tx
          .select()
          .from(equipmentAssets)
          .where(
            and(
              eq(equipmentAssets.id, dto.equipmentId),
              eq(equipmentAssets.organizationId, actor.orgId),
            ),
          )
          .limit(1);

        if (!eqItem) throw new NotFoundException('Equipment asset not found.');

        await tx.insert(equipmentServiceLogs).values({
          id: logId,
          organizationId: actor.orgId,
          equipmentId: dto.equipmentId,
          serviceType: dto.serviceType,
          costMinor: dto.costMinor,
          downtimeMinutes: dto.downtimeMinutes,
          notes: dto.notes,
          recordedByUserId: actor.sub,
        });

        await tx
          .update(equipmentAssets)
          .set({
            status: 'OPERATIONAL',
            ...(dto.nextPreventiveMaintenanceAt
              ? { nextPreventiveMaintenanceAt: new Date(dto.nextPreventiveMaintenanceAt) }
              : {}),
            ...(dto.nextCalibrationAt ? { nextCalibrationAt: new Date(dto.nextCalibrationAt) } : {}),
            updatedAt: new Date(),
          })
          .where(eq(equipmentAssets.id, dto.equipmentId));
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: actor.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'EQUIPMENT_SERVICED',
      resourceType: 'equipment_service_log',
      resourceId: logId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { equipmentId: dto.equipmentId, serviceType: dto.serviceType, costMinor: dto.costMinor },
    });

    return { logId, status: 'OPERATIONAL' };
  }

  async createTicket(actor: AccessTokenClaims, dto: CreateMaintenanceTicketDto) {
    const ticketId = randomUUID();
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(maintenanceTickets).values({
          id: ticketId,
          organizationId: actor.orgId,
          branchId: dto.branchId,
          equipmentId: dto.equipmentId ?? null,
          ticketType: dto.ticketType,
          priority: dto.priority,
          description: dto.description,
          assignedToUserId: dto.assignedToUserId ?? null,
          reportedByUserId: actor.sub,
        });

        if (dto.equipmentId && dto.priority === 'CRITICAL') {
          await tx
            .update(equipmentAssets)
            .set({ status: 'DOWN', updatedAt: new Date() })
            .where(eq(equipmentAssets.id, dto.equipmentId));
        }
      },
    );
    return { ticketId, status: 'OPEN' };
  }

  async updateTicket(actor: AccessTokenClaims, ticketId: string, dto: UpdateMaintenanceTicketDto) {
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        await tx
          .update(maintenanceTickets)
          .set({
            status: dto.status,
            ...(dto.assignedToUserId ? { assignedToUserId: dto.assignedToUserId } : {}),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(maintenanceTickets.id, ticketId),
              eq(maintenanceTickets.organizationId, actor.orgId),
            ),
          );
      },
    );
    return { ticketId, status: dto.status };
  }

  async getMaintenanceCostAndDowntimeReport(actor: AccessTokenClaims) {
    return withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        const [summary] = await tx
          .select({
            totalCostMinor: sql<number>`coalesce(sum(${equipmentServiceLogs.costMinor}), 0)`,
            totalDowntimeMinutes: sql<number>`coalesce(sum(${equipmentServiceLogs.downtimeMinutes}), 0)`,
          })
          .from(equipmentServiceLogs)
          .where(eq(equipmentServiceLogs.organizationId, actor.orgId));

        return {
          totalMaintenanceCostMinor: Number(summary?.totalCostMinor ?? 0),
          totalDowntimeMinutes: Number(summary?.totalDowntimeMinutes ?? 0),
        };
      },
    );
  }
}
