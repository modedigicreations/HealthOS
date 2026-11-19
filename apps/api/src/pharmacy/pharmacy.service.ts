import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, gt, lte, sql } from 'drizzle-orm';
import type {
  AdjustStockDto,
  CreateInventoryItemDto,
  DispensePrescriptionDto,
  ReceiveInventoryBatchDto,
  TransferStockDto,
} from '@healthos/contracts';
import {
  dispenseLogs,
  inventoryBatches,
  inventoryItems,
  patientAllergies,
  patientMedicationHistory,
  prescriptions,
  stockMovements,
  withTenantContext,
} from '@healthos/db';
import { AuditService } from '../audit/audit.service.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { CryptoService, DbService, type AccessTokenClaims } from '../security/security.module.js';

const KNOWN_INTERACTION_PAIRS: ReadonlyArray<{
  a: string;
  b: string;
  severity: 'MODERATE' | 'MAJOR';
  description: string;
}> = [
  {
    a: 'warfarin',
    b: 'nsaid',
    severity: 'MAJOR',
    description: 'Increased risk of gastrointestinal and systemic bleeding.',
  },
  {
    a: 'warfarin',
    b: 'aspirin',
    severity: 'MAJOR',
    description: 'Additive anticoagulant/antiplatelet bleeding risk.',
  },
  {
    a: 'ace_inhibitor',
    b: 'spironolactone',
    severity: 'MAJOR',
    description: 'Risk of severe hyperkalemia.',
  },
  {
    a: 'sildenafil',
    b: 'nitrate',
    severity: 'MAJOR',
    description: 'Risk of life-threatening hypotension.',
  },
];

@Injectable()
export class PharmacyService {
  constructor(
    private readonly dbService: DbService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  async createItem(actor: AccessTokenClaims, dto: CreateInventoryItemDto) {
    const itemId = randomUUID();
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(inventoryItems).values({
          id: itemId,
          organizationId: actor.orgId,
          sku: dto.sku.toUpperCase(),
          name: dto.name,
          itemType: dto.itemType,
          genericName: dto.genericName ?? null,
          dosageForm: dto.dosageForm ?? null,
          strength: dto.strength ?? null,
          unitOfMeasure: dto.unitOfMeasure,
          reorderLevel: dto.reorderLevel,
          unitPriceMinor: dto.unitPriceMinor,
          drugClass: dto.drugClass ?? null,
        });
      },
    );
    return { itemId, sku: dto.sku.toUpperCase() };
  }

  async listItems(actor: AccessTokenClaims) {
    return withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        return tx
          .select()
          .from(inventoryItems)
          .where(and(eq(inventoryItems.organizationId, actor.orgId), eq(inventoryItems.isActive, true)));
      },
    );
  }

  async receiveBatch(actor: AccessTokenClaims, dto: ReceiveInventoryBatchDto, meta: RequestMeta) {
    const batchId = randomUUID();
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(inventoryBatches).values({
          id: batchId,
          organizationId: actor.orgId,
          branchId: dto.branchId,
          itemId: dto.itemId,
          batchNumber: dto.batchNumber,
          lotNumber: dto.lotNumber ?? null,
          quantityOnHand: dto.quantity,
          unitCostMinor: dto.unitCostMinor,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          supplierName: dto.supplierName ?? null,
        });

        await tx.insert(stockMovements).values({
          organizationId: actor.orgId,
          branchId: dto.branchId,
          itemId: dto.itemId,
          batchId,
          movementType: 'RECEIVE',
          quantityDelta: dto.quantity,
          notes: `Received batch ${dto.batchNumber}`,
          performedByUserId: actor.sub,
        });
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: dto.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'INVENTORY_BATCH_RECEIVED',
      resourceType: 'inventory_batch',
      resourceId: batchId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { itemId: dto.itemId, quantity: dto.quantity, batchNumber: dto.batchNumber },
    });

    return { batchId, quantityOnHand: dto.quantity };
  }

  async dispenseMedication(
    actor: AccessTokenClaims,
    dto: DispensePrescriptionDto,
    meta: RequestMeta,
  ) {
    const alerts: string[] = [];

    const result = await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        const [item] = await tx
          .select()
          .from(inventoryItems)
          .where(and(eq(inventoryItems.id, dto.itemId), eq(inventoryItems.organizationId, actor.orgId)))
          .limit(1);

        if (!item) throw new NotFoundException('Inventory item not found.');

        const candidateTerms = [
          item.name.toLowerCase(),
          item.genericName?.toLowerCase() ?? '',
          item.drugClass?.toLowerCase() ?? '',
        ].filter(Boolean);

        // 1. Check patient allergies
        const allergies = await tx
          .select()
          .from(patientAllergies)
          .where(eq(patientAllergies.patientId, dto.patientId));

        for (const a of allergies) {
          const details = await this.crypto.cipher.decryptJson<{ allergen: string; reaction: string }>(
            a.detailsEncrypted,
            {
              organizationId: actor.orgId,
              tableName: 'patient_allergies',
              recordId: a.id,
              fieldName: 'details',
            },
          );
          const allergenLower = details.allergen.toLowerCase();
          if (candidateTerms.some((t) => t.includes(allergenLower) || allergenLower.includes(t))) {
            alerts.push(
              `ALLERGY (${a.severity}): Patient allergic to ${details.allergen} (${details.reaction})`,
            );
          }
        }

        // 2. Check current medications for drug-drug interactions
        const currentMeds = await tx
          .select()
          .from(patientMedicationHistory)
          .where(
            and(
              eq(patientMedicationHistory.patientId, dto.patientId),
              eq(patientMedicationHistory.isCurrent, true),
            ),
          );

        for (const m of currentMeds) {
          const details = await this.crypto.cipher.decryptJson<{ medicationName: string }>(
            m.detailsEncrypted,
            {
              organizationId: actor.orgId,
              tableName: 'patient_medication_history',
              recordId: m.id,
              fieldName: 'details',
            },
          );
          const medLower = details.medicationName.toLowerCase();
          for (const pair of KNOWN_INTERACTION_PAIRS) {
            const matchesA = candidateTerms.some((t) => t.includes(pair.a)) && medLower.includes(pair.b);
            const matchesB = candidateTerms.some((t) => t.includes(pair.b)) && medLower.includes(pair.a);
            if (matchesA || matchesB) {
              alerts.push(
                `INTERACTION (${pair.severity}) with ${details.medicationName}: ${pair.description}`,
              );
            }
          }
        }

        if (alerts.length > 0 && !dto.overrideClinicalAlertReason) {
          throw new ConflictException({
            message: 'Clinical safety alert(s) detected. Provide overrideClinicalAlertReason to proceed.',
            alerts,
          });
        }

        // 3. FEFO (First-Expired-First-Out) non-expired batch deduction
        const now = new Date();
        const batches = await tx
          .select()
          .from(inventoryBatches)
          .where(
            and(
              eq(inventoryBatches.organizationId, actor.orgId),
              eq(inventoryBatches.branchId, dto.branchId),
              eq(inventoryBatches.itemId, dto.itemId),
              gt(inventoryBatches.quantityOnHand, 0),
            ),
          )
          .orderBy(asc(inventoryBatches.expiresAt));

        const validBatches = batches.filter((b) => !b.expiresAt || b.expiresAt > now);
        const totalAvailable = validBatches.reduce((sum, b) => sum + b.quantityOnHand, 0);
        if (totalAvailable < dto.quantity) {
          throw new BadRequestException(
            `Insufficient non-expired stock. Available: ${totalAvailable}, requested: ${dto.quantity}.`,
          );
        }

        let remaining = dto.quantity;
        const dispenseIds: string[] = [];

        for (const batch of validBatches) {
          if (remaining <= 0) break;
          const take = Math.min(batch.quantityOnHand, remaining);
          remaining -= take;

          await tx
            .update(inventoryBatches)
            .set({ quantityOnHand: batch.quantityOnHand - take })
            .where(eq(inventoryBatches.id, batch.id));

          await tx.insert(stockMovements).values({
            organizationId: actor.orgId,
            branchId: dto.branchId,
            itemId: dto.itemId,
            batchId: batch.id,
            movementType: 'DISPENSE',
            quantityDelta: -take,
            notes: dto.isRefill ? 'Prescription refill' : 'Prescription dispense',
            performedByUserId: actor.sub,
          });

          const dispenseId = randomUUID();
          const clinicalAlertsEncrypted =
            alerts.length > 0
              ? await this.crypto.cipher.encryptJson(
                  { alerts, overrideReason: dto.overrideClinicalAlertReason },
                  {
                    organizationId: actor.orgId,
                    tableName: 'dispense_logs',
                    recordId: dispenseId,
                    fieldName: 'clinical_alerts',
                  },
                )
              : null;

          await tx.insert(dispenseLogs).values({
            id: dispenseId,
            organizationId: actor.orgId,
            branchId: dto.branchId,
            prescriptionId: dto.prescriptionId ?? null,
            patientId: dto.patientId,
            itemId: dto.itemId,
            batchId: batch.id,
            quantityDispensed: take,
            isRefill: dto.isRefill,
            clinicalAlertsEncrypted,
            dispensedByUserId: actor.sub,
          });
          dispenseIds.push(dispenseId);
        }

        if (dto.prescriptionId) {
          await tx
            .update(prescriptions)
            .set({ status: 'DISPENSED' })
            .where(eq(prescriptions.id, dto.prescriptionId));
        }

        return { dispenseIds, alertsOverridden: alerts.length > 0 };
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: dto.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: result.alertsOverridden ? 'PHARMACY_CLINICAL_ALERT_OVERRIDE' : 'PHARMACY_DISPENSED',
      resourceType: 'dispense',
      resourceId: result.dispenseIds[0] ?? null,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        patientId: dto.patientId,
        itemId: dto.itemId,
        quantity: dto.quantity,
        alertsCount: alerts.length,
      },
    });

    return result;
  }

  async transferStock(actor: AccessTokenClaims, dto: TransferStockDto, meta: RequestMeta) {
    if (dto.fromBranchId === dto.toBranchId) {
      throw new BadRequestException('Source and destination branches must differ.');
    }

    const newBatchId = randomUUID();
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.fromBranchId, actorId: actor.sub },
      async (tx) => {
        const [source] = await tx
          .select()
          .from(inventoryBatches)
          .where(
            and(
              eq(inventoryBatches.id, dto.batchId),
              eq(inventoryBatches.branchId, dto.fromBranchId),
            ),
          )
          .limit(1);

        if (!source) throw new NotFoundException('Source batch not found.');
        if (source.quantityOnHand < dto.quantity) {
          throw new BadRequestException('Insufficient quantity in source batch.');
        }

        await tx
          .update(inventoryBatches)
          .set({ quantityOnHand: source.quantityOnHand - dto.quantity })
          .where(eq(inventoryBatches.id, source.id));

        await tx.insert(inventoryBatches).values({
          id: newBatchId,
          organizationId: actor.orgId,
          branchId: dto.toBranchId,
          itemId: source.itemId,
          batchNumber: source.batchNumber,
          lotNumber: source.lotNumber,
          quantityOnHand: dto.quantity,
          unitCostMinor: source.unitCostMinor,
          expiresAt: source.expiresAt,
          supplierName: source.supplierName,
        });

        await tx.insert(stockMovements).values([
          {
            organizationId: actor.orgId,
            branchId: dto.fromBranchId,
            itemId: source.itemId,
            batchId: source.id,
            movementType: 'TRANSFER_OUT',
            quantityDelta: -dto.quantity,
            notes: dto.notes ?? `Transfer to branch ${dto.toBranchId}`,
            performedByUserId: actor.sub,
          },
          {
            organizationId: actor.orgId,
            branchId: dto.toBranchId,
            itemId: source.itemId,
            batchId: newBatchId,
            movementType: 'TRANSFER_IN',
            quantityDelta: dto.quantity,
            notes: dto.notes ?? `Transfer from branch ${dto.fromBranchId}`,
            performedByUserId: actor.sub,
          },
        ]);
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: dto.fromBranchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'INVENTORY_TRANSFERRED',
      resourceType: 'inventory_batch',
      resourceId: newBatchId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        fromBranchId: dto.fromBranchId,
        toBranchId: dto.toBranchId,
        quantity: dto.quantity,
      },
    });

    return { sourceBatchId: dto.batchId, destinationBatchId: newBatchId, quantity: dto.quantity };
  }

  async adjustStock(actor: AccessTokenClaims, dto: AdjustStockDto, meta: RequestMeta) {
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        const [batch] = await tx
          .select()
          .from(inventoryBatches)
          .where(and(eq(inventoryBatches.id, dto.batchId), eq(inventoryBatches.branchId, dto.branchId)))
          .limit(1);

        if (!batch) throw new NotFoundException('Batch not found.');
        const updatedQty = batch.quantityOnHand + dto.deltaQuantity;
        if (updatedQty < 0) {
          throw new BadRequestException('Adjustment would result in negative stock.');
        }

        await tx
          .update(inventoryBatches)
          .set({ quantityOnHand: updatedQty })
          .where(eq(inventoryBatches.id, batch.id));

        await tx.insert(stockMovements).values({
          organizationId: actor.orgId,
          branchId: dto.branchId,
          itemId: batch.itemId,
          batchId: batch.id,
          movementType: dto.reason,
          quantityDelta: dto.deltaQuantity,
          notes: dto.notes ?? null,
          performedByUserId: actor.sub,
        });
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: dto.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'INVENTORY_ADJUSTED',
      resourceType: 'inventory_batch',
      resourceId: dto.batchId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { deltaQuantity: dto.deltaQuantity, reason: dto.reason },
    });

    return { batchId: dto.batchId, reason: dto.reason };
  }

  async getInventoryAlerts(actor: AccessTokenClaims, branchId: string) {
    const sixtyDaysFromNow = new Date(Date.now() + 60 * 86_400_000);

    return withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId, actorId: actor.sub },
      async (tx) => {
        const expiringBatches = await tx
          .select()
          .from(inventoryBatches)
          .where(
            and(
              eq(inventoryBatches.organizationId, actor.orgId),
              eq(inventoryBatches.branchId, branchId),
              gt(inventoryBatches.quantityOnHand, 0),
              lte(inventoryBatches.expiresAt, sixtyDaysFromNow),
            ),
          );

        const stockSummary = await tx
          .select({
            itemId: inventoryItems.id,
            name: inventoryItems.name,
            reorderLevel: inventoryItems.reorderLevel,
            totalQty: sql<number>`coalesce(sum(${inventoryBatches.quantityOnHand}), 0)`,
          })
          .from(inventoryItems)
          .leftJoin(
            inventoryBatches,
            and(
              eq(inventoryBatches.itemId, inventoryItems.id),
              eq(inventoryBatches.branchId, branchId),
            ),
          )
          .where(eq(inventoryItems.organizationId, actor.orgId))
          .groupBy(inventoryItems.id, inventoryItems.name, inventoryItems.reorderLevel);

        const lowStockItems = stockSummary.filter((s) => Number(s.totalQty) <= s.reorderLevel);
        return { lowStockItems, expiringBatches };
      },
    );
  }

  async getValuationReport(actor: AccessTokenClaims, branchId?: string) {
    return withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: branchId ?? actor.branchId, actorId: actor.sub },
      async (tx) => {
        const conditions = [
          eq(inventoryBatches.organizationId, actor.orgId),
          gt(inventoryBatches.quantityOnHand, 0),
        ];
        if (branchId) conditions.push(eq(inventoryBatches.branchId, branchId));

        const [totals] = await tx
          .select({
            totalUnits: sql<number>`coalesce(sum(${inventoryBatches.quantityOnHand}), 0)`,
            totalCostMinor: sql<number>`coalesce(sum(${inventoryBatches.quantityOnHand} * ${inventoryBatches.unitCostMinor}), 0)`,
          })
          .from(inventoryBatches)
          .where(and(...conditions));

        return {
          totalUnits: Number(totals?.totalUnits ?? 0),
          totalValuationMinor: Number(totals?.totalCostMinor ?? 0),
        };
      },
    );
  }
}
