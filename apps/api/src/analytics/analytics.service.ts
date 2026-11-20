import { Injectable } from '@nestjs/common';
import { and, count, eq, sql } from 'drizzle-orm';
import {
  appointments,
  consultations,
  equipmentServiceLogs,
  hmoClaims,
  invoices,
  labOrders,
  patientSurveys,
  patients,
  purchaseOrders,
  withTenantContext,
} from '@healthos/db';
import { DbService, type AccessTokenClaims } from '../security/security.module.js';

@Injectable()
export class AnalyticsService {
  constructor(private readonly dbService: DbService) {}

  async getExecutiveDashboard(actor: AccessTokenClaims, branchId?: string) {
    return withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: branchId ?? actor.branchId, actorId: actor.sub },
      async (tx) => {
        const orgFilter = (col: any) =>
          branchId
            ? and(eq(col.organizationId, actor.orgId), eq(col.branchId, branchId))
            : eq(col.organizationId, actor.orgId);

        const [patientStats] = await tx.select({ total: count(patients.id) }).from(patients).where(orgFilter(patients));
        const [visitStats] = await tx.select({ total: count(appointments.id) }).from(appointments).where(orgFilter(appointments));
        const [consultStats] = await tx.select({ total: count(consultations.id) }).from(consultations).where(orgFilter(consultations));
        const [labStats] = await tx.select({ total: count(labOrders.id) }).from(labOrders).where(orgFilter(labOrders));
        const [billingStats] = await tx
          .select({
            totalBilledMinor: sql<number>`coalesce(sum(${invoices.totalMinor}), 0)`,
            totalCollectedMinor: sql<number>`coalesce(sum(${invoices.paidMinor}), 0)`,
          })
          .from(invoices)
          .where(orgFilter(invoices));
        const [hmoStats] = await tx
          .select({
            totalClaimedMinor: sql<number>`coalesce(sum(${hmoClaims.claimedAmountMinor}), 0)`,
            totalApprovedMinor: sql<number>`coalesce(sum(${hmoClaims.approvedAmountMinor}), 0)`,
          })
          .from(hmoClaims)
          .where(orgFilter(hmoClaims));
        const [procurementStats] = await tx
          .select({
            totalSpendMinor: sql<number>`coalesce(sum(${purchaseOrders.totalAmountMinor}), 0)`,
          })
          .from(purchaseOrders)
          .where(orgFilter(purchaseOrders));
        const [surveyStats] = await tx
          .select({
            avgRating: sql<number>`coalesce(avg(${patientSurveys.rating}), 0)`,
            responses: count(patientSurveys.id),
          })
          .from(patientSurveys)
          .where(orgFilter(patientSurveys));
        const [equipmentStats] = await tx
          .select({
            maintenanceCostMinor: sql<number>`coalesce(sum(${equipmentServiceLogs.costMinor}), 0)`,
            downtimeMinutes: sql<number>`coalesce(sum(${equipmentServiceLogs.downtimeMinutes}), 0)`,
          })
          .from(equipmentServiceLogs)
          .where(eq(equipmentServiceLogs.organizationId, actor.orgId));

        return {
          scope: branchId ? { branchId } : { organizationId: actor.orgId },
          patients: { totalRegistered: Number(patientStats?.total ?? 0) },
          clinical: {
            totalAppointments: Number(visitStats?.total ?? 0),
            totalConsultations: Number(consultStats?.total ?? 0),
          },
          laboratory: { totalOrders: Number(labStats?.total ?? 0) },
          finance: {
            totalBilledMinor: Number(billingStats?.totalBilledMinor ?? 0),
            totalCollectedMinor: Number(billingStats?.totalCollectedMinor ?? 0),
            outstandingMinor: Math.max(
              0,
              Number(billingStats?.totalBilledMinor ?? 0) -
                Number(billingStats?.totalCollectedMinor ?? 0),
            ),
            hmoClaimedMinor: Number(hmoStats?.totalClaimedMinor ?? 0),
            hmoApprovedMinor: Number(hmoStats?.totalApprovedMinor ?? 0),
            procurementSpendMinor: Number(procurementStats?.totalSpendMinor ?? 0),
          },
          operations: {
            equipmentMaintenanceCostMinor: Number(equipmentStats?.maintenanceCostMinor ?? 0),
            equipmentDowntimeMinutes: Number(equipmentStats?.downtimeMinutes ?? 0),
            patientSatisfactionAvg: Number(Number(surveyStats?.avgRating ?? 0).toFixed(2)),
            surveyResponses: Number(surveyStats?.responses ?? 0),
          },
        };
      },
    );
  }
}
