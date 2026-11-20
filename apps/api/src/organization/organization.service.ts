import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { count, eq, sql } from 'drizzle-orm';
import type { AssignUserBranchDto, CreateBranchDto } from '@healthos/contracts';
import {
  branches,
  incidentReports,
  invoices,
  patients,
  userBranchAccess,
  withTenantContext,
} from '@healthos/db';
import { AuditService } from '../audit/audit.service.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { CryptoService, DbService, type AccessTokenClaims } from '../security/security.module.js';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly dbService: DbService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  async createBranch(actor: AccessTokenClaims, dto: CreateBranchDto, meta: RequestMeta) {
    const branchId = randomUUID();
    const addressEncrypted = dto.address
      ? await this.crypto.cipher.encryptString(dto.address, {
          organizationId: actor.orgId,
          tableName: 'branches',
          recordId: branchId,
          fieldName: 'address',
        })
      : null;

    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(branches).values({
          id: branchId,
          organizationId: actor.orgId,
          name: dto.name,
          code: dto.code.toUpperCase(),
          facilityType: dto.facilityType,
          addressEncrypted,
        });
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'BRANCH_CREATED',
      resourceType: 'branch',
      resourceId: branchId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { code: dto.code.toUpperCase(), facilityType: dto.facilityType },
    });

    return { branchId, code: dto.code.toUpperCase() };
  }

  async listBranches(actor: AccessTokenClaims) {
    return withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        return tx
          .select({
            id: branches.id,
            name: branches.name,
            code: branches.code,
            facilityType: branches.facilityType,
            isActive: branches.isActive,
          })
          .from(branches)
          .where(eq(branches.organizationId, actor.orgId));
      },
    );
  }

  async assignUserToBranch(actor: AccessTokenClaims, dto: AssignUserBranchDto, meta: RequestMeta) {
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        await tx
          .insert(userBranchAccess)
          .values({
            organizationId: actor.orgId,
            userId: dto.userId,
            branchId: dto.branchId,
            department: dto.department ?? null,
            isDefault: dto.isDefault,
          })
          .onConflictDoNothing();
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: dto.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'BRANCH_USER_ASSIGNED',
      resourceType: 'user_branch_access',
      resourceId: dto.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { branchId: dto.branchId, department: dto.department ?? null },
    });

    return { userId: dto.userId, branchId: dto.branchId };
  }

  async getBranchComparison(actor: AccessTokenClaims) {
    return withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        const branchList = await tx
          .select({ id: branches.id, name: branches.name, code: branches.code })
          .from(branches)
          .where(eq(branches.organizationId, actor.orgId));

        const revenueRows = await tx
          .select({
            branchId: invoices.branchId,
            revenueMinor: sql<number>`coalesce(sum(${invoices.paidMinor}), 0)`,
          })
          .from(invoices)
          .where(eq(invoices.organizationId, actor.orgId))
          .groupBy(invoices.branchId);
        const patientRows = await tx
          .select({ branchId: patients.branchId, patientsCount: count(patients.id) })
          .from(patients)
          .where(eq(patients.organizationId, actor.orgId))
          .groupBy(patients.branchId);
        const incidentRows = await tx
          .select({ branchId: incidentReports.branchId, incidentsCount: count(incidentReports.id) })
          .from(incidentReports)
          .where(eq(incidentReports.organizationId, actor.orgId))
          .groupBy(incidentReports.branchId);

        return branchList.map((b) => ({
          branchId: b.id,
          name: b.name,
          code: b.code,
          collectedRevenueMinor: Number(
            revenueRows.find((r) => r.branchId === b.id)?.revenueMinor ?? 0,
          ),
          registeredPatients: Number(
            patientRows.find((p) => p.branchId === b.id)?.patientsCount ?? 0,
          ),
          incidentsCount: Number(
            incidentRows.find((i) => i.branchId === b.id)?.incidentsCount ?? 0,
          ),
        }));
      },
    );
  }
}
