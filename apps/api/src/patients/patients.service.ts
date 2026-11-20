import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { and, desc, eq, or, type SQL } from 'drizzle-orm';
import {
  hasPermission,
  type CreateReferralDto,
  type MergePatientsDto,
  type RecordAllergyDto,
  type RecordMedicationHistoryDto,
  type RecordVitalsDto,
  type RegisterPatientDto,
  type SearchPatientDto,
  type UpdateConsentDto,
} from '@healthos/contracts';
import {
  branches,
  patientAllergies,
  patientAttachments,
  patientConsents,
  patientMedicationHistory,
  patientReferrals,
  patientVitals,
  patients,
  withTenantContext,
} from '@healthos/db';
import { AuditService } from '../audit/audit.service.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { CryptoService, DbService, type AccessTokenClaims } from '../security/security.module.js';

export interface PatientDemographics {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email?: string;
  nationalId?: string;
  address?: string;
}

@Injectable()
export class PatientsService {
  constructor(
    private readonly dbService: DbService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  private async assertActivePatient(
    tx: Parameters<Parameters<typeof withTenantContext>[2]>[0],
    organizationId: string,
    patientId: string,
  ): Promise<void> {
    const [p] = await tx
      .select({ id: patients.id, status: patients.status })
      .from(patients)
      .where(and(eq(patients.id, patientId), eq(patients.organizationId, organizationId)))
      .limit(1);
    if (!p) throw new NotFoundException('Patient not found.');
    if (p.status === 'MERGED') {
      throw new BadRequestException('Cannot modify a merged duplicate patient record.');
    }
  }

  async registerPatient(actor: AccessTokenClaims, dto: RegisterPatientDto, meta: RequestMeta) {
    const patientId = randomUUID();
    const year = new Date().getUTCFullYear();
    const suffix = randomBytes(3).toString('hex').toUpperCase();

    const phoneBlind = this.crypto.blindIndex.compute(dto.phone, {
      organizationId: actor.orgId,
      field: 'phone',
    });
    const emailBlind = dto.email
      ? this.crypto.blindIndex.compute(dto.email, { organizationId: actor.orgId, field: 'email' })
      : null;
    const nidBlind = dto.nationalId
      ? this.crypto.blindIndex.compute(dto.nationalId, {
          organizationId: actor.orgId,
          field: 'national_id',
        })
      : null;

    const demographics: PatientDemographics = {
      firstName: dto.firstName,
      lastName: dto.lastName,
      dateOfBirth: dto.dateOfBirth,
      gender: dto.gender,
      phone: dto.phone,
      email: dto.email,
      nationalId: dto.nationalId,
      address: dto.address,
    };

    const demographicsEncrypted = await this.crypto.cipher.encryptJson(demographics, {
      organizationId: actor.orgId,
      tableName: 'patients',
      recordId: patientId,
      fieldName: 'demographics',
    });

    const emergencyContactsEncrypted = await this.crypto.cipher.encryptJson(
      { nextOfKin: dto.nextOfKin ?? null, emergencyContacts: dto.emergencyContacts },
      {
        organizationId: actor.orgId,
        tableName: 'patients',
        recordId: patientId,
        fieldName: 'emergency_contacts',
      },
    );

    const medicalHistoryEncrypted = dto.medicalHistorySummary
      ? await this.crypto.cipher.encryptString(dto.medicalHistorySummary, {
          organizationId: actor.orgId,
          tableName: 'patients',
          recordId: patientId,
          fieldName: 'medical_history',
        })
      : null;

    const result = await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        const [branch] = await tx
          .select({ code: branches.code })
          .from(branches)
          .where(and(eq(branches.id, dto.branchId), eq(branches.organizationId, actor.orgId)))
          .limit(1);

        if (!branch) {
          throw new NotFoundException('Branch not found in organization.');
        }

        const dupConditions = [eq(patients.phoneBlindIndex, phoneBlind)];
        if (emailBlind) dupConditions.push(eq(patients.emailBlindIndex, emailBlind));
        if (nidBlind) dupConditions.push(eq(patients.nationalIdBlindIndex, nidBlind));

        const potentialDuplicates = await tx
          .select({ id: patients.id, patientNumber: patients.patientNumber })
          .from(patients)
          .where(
            and(
              eq(patients.organizationId, actor.orgId),
              eq(patients.status, 'ACTIVE'),
              or(...dupConditions),
            ),
          )
          .limit(5);

        const patientNumber = `HOS-${branch.code}-${year}-${suffix}`;

        await tx.insert(patients).values({
          id: patientId,
          organizationId: actor.orgId,
          branchId: dto.branchId,
          patientNumber,
          demographicsEncrypted,
          emergencyContactsEncrypted,
          medicalHistoryEncrypted,
          phoneBlindIndex: phoneBlind,
          emailBlindIndex: emailBlind,
          nationalIdBlindIndex: nidBlind,
          bloodGroup: dto.bloodGroup,
          genotype: dto.genotype,
          createdByUserId: actor.sub,
        });

        return { patientId, patientNumber, potentialDuplicates };
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: dto.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'PATIENT_REGISTERED',
      resourceType: 'patient',
      resourceId: patientId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        patientNumber: result.patientNumber,
        duplicateCount: result.potentialDuplicates.length,
      },
    });

    return result;
  }

  async searchPatients(actor: AccessTokenClaims, query: SearchPatientDto, meta: RequestMeta) {
    if (actor.role === 'PATIENT') {
      throw new ForbiddenException('Patients cannot search other patient records.');
    }

    const conditions: SQL[] = [];
    if (query.patientNumber) {
      conditions.push(eq(patients.patientNumber, query.patientNumber.trim()));
    }
    if (query.phone) {
      conditions.push(
        eq(
          patients.phoneBlindIndex,
          this.crypto.blindIndex.compute(query.phone, {
            organizationId: actor.orgId,
            field: 'phone',
          }),
        ),
      );
    }
    if (query.email) {
      conditions.push(
        eq(
          patients.emailBlindIndex,
          this.crypto.blindIndex.compute(query.email, {
            organizationId: actor.orgId,
            field: 'email',
          }),
        ),
      );
    }
    if (query.nationalId) {
      conditions.push(
        eq(
          patients.nationalIdBlindIndex,
          this.crypto.blindIndex.compute(query.nationalId, {
            organizationId: actor.orgId,
            field: 'national_id',
          }),
        ),
      );
    }

    if (conditions.length === 0) {
      throw new BadRequestException('Provide at least one search criterion.');
    }

    const rows = await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: actor.branchId, actorId: actor.sub },
      async (tx) => {
        return tx
          .select()
          .from(patients)
          .where(
            and(
              eq(patients.organizationId, actor.orgId),
              eq(patients.status, 'ACTIVE'),
              or(...conditions),
            ),
          )
          .limit(20);
      },
    );

    const results = await Promise.all(
      rows.map(async (row) => {
        const demographics = await this.crypto.cipher.decryptJson<PatientDemographics>(
          row.demographicsEncrypted,
          {
            organizationId: actor.orgId,
            tableName: 'patients',
            recordId: row.id,
            fieldName: 'demographics',
          },
        );
        return {
          id: row.id,
          patientNumber: row.patientNumber,
          branchId: row.branchId,
          bloodGroup: row.bloodGroup,
          genotype: row.genotype,
          demographics,
          createdAt: row.createdAt,
        };
      }),
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: actor.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'PATIENT_SEARCH',
      resourceType: 'patient',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { resultCount: results.length },
    });

    return results;
  }

  async getPatientEmr(
    actor: AccessTokenClaims,
    patientId: string,
    meta: RequestMeta,
    options?: { department?: string; breakGlassReason?: string },
  ) {
    const data = await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: actor.branchId, actorId: actor.sub },
      async (tx) => {
        const [patient] = await tx
          .select()
          .from(patients)
          .where(and(eq(patients.id, patientId), eq(patients.organizationId, actor.orgId)))
          .limit(1);

        if (!patient) {
          throw new NotFoundException('Patient not found.');
        }

        if (actor.role === 'PATIENT' && patient.portalUserId !== actor.sub) {
          throw new ForbiddenException('Patients can only view their own medical records.');
        }

        const consents = await tx
          .select()
          .from(patientConsents)
          .where(eq(patientConsents.patientId, patient.id));

        if (options?.department && actor.role !== 'PATIENT') {
          const hasConsent = consents.some(
            (c) =>
              c.consentType === 'INTER_DEPARTMENT_SHARING' &&
              c.granted &&
              (!c.scopeDepartment || c.scopeDepartment === options.department),
          );

          if (!hasConsent) {
            if (!options.breakGlassReason || !hasPermission(actor.role, 'emr:break_glass')) {
              throw new ForbiddenException(
                'Inter-department sharing consent not granted; break-glass authorization required.',
              );
            }
          }
        }

        const vitals = await tx
          .select()
          .from(patientVitals)
          .where(eq(patientVitals.patientId, patient.id))
          .orderBy(desc(patientVitals.recordedAt))
          .limit(25);
        const allergies = await tx
          .select()
          .from(patientAllergies)
          .where(eq(patientAllergies.patientId, patient.id));
        const medications = await tx
          .select()
          .from(patientMedicationHistory)
          .where(eq(patientMedicationHistory.patientId, patient.id));
        const referrals = await tx
          .select()
          .from(patientReferrals)
          .where(eq(patientReferrals.patientId, patient.id));

        return { patient, vitals, allergies, medications, consents, referrals };
      },
    );

    const demographics = await this.crypto.cipher.decryptJson<PatientDemographics>(
      data.patient.demographicsEncrypted,
      {
        organizationId: actor.orgId,
        tableName: 'patients',
        recordId: data.patient.id,
        fieldName: 'demographics',
      },
    );

    const emergencyContacts = data.patient.emergencyContactsEncrypted
      ? await this.crypto.cipher.decryptJson(data.patient.emergencyContactsEncrypted, {
          organizationId: actor.orgId,
          tableName: 'patients',
          recordId: data.patient.id,
          fieldName: 'emergency_contacts',
        })
      : null;

    const medicalHistorySummary = data.patient.medicalHistoryEncrypted
      ? await this.crypto.cipher.decryptString(data.patient.medicalHistoryEncrypted, {
          organizationId: actor.orgId,
          tableName: 'patients',
          recordId: data.patient.id,
          fieldName: 'medical_history',
        })
      : null;

    const allergies = await Promise.all(
      data.allergies.map(async (a) => ({
        id: a.id,
        category: a.category,
        severity: a.severity,
        details: await this.crypto.cipher.decryptJson(a.detailsEncrypted, {
          organizationId: actor.orgId,
          tableName: 'patient_allergies',
          recordId: a.id,
          fieldName: 'details',
        }),
        createdAt: a.createdAt,
      })),
    );

    const medications = await Promise.all(
      data.medications.map(async (m) => ({
        id: m.id,
        isCurrent: m.isCurrent,
        details: await this.crypto.cipher.decryptJson(m.detailsEncrypted, {
          organizationId: actor.orgId,
          tableName: 'patient_medication_history',
          recordId: m.id,
          fieldName: 'details',
        }),
        createdAt: m.createdAt,
      })),
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: actor.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: options?.breakGlassReason ? 'EMR_BREAK_GLASS_ACCESS' : 'PHI_EMR_READ',
      resourceType: 'patient',
      resourceId: patientId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        department: options?.department ?? null,
        breakGlass: Boolean(options?.breakGlassReason),
      },
    });

    return {
      id: data.patient.id,
      patientNumber: data.patient.patientNumber,
      status: data.patient.status,
      mergedIntoPatientId: data.patient.mergedIntoPatientId,
      bloodGroup: data.patient.bloodGroup,
      genotype: data.patient.genotype,
      demographics,
      emergencyContacts,
      medicalHistorySummary,
      vitals: data.vitals,
      allergies,
      medications,
      consents: data.consents,
      referralsCount: data.referrals.length,
    };
  }

  async recordVitals(
    actor: AccessTokenClaims,
    patientId: string,
    dto: RecordVitalsDto,
    meta: RequestMeta,
  ) {
    if (!actor.branchId) {
      throw new BadRequestException('Branch context is required to record vitals.');
    }
    const branchId = actor.branchId;
    const vitalId = randomUUID();
    const notesEncrypted = dto.notes
      ? await this.crypto.cipher.encryptString(dto.notes, {
          organizationId: actor.orgId,
          tableName: 'patient_vitals',
          recordId: vitalId,
          fieldName: 'notes',
        })
      : null;

    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId, actorId: actor.sub },
      async (tx) => {
        await this.assertActivePatient(tx, actor.orgId, patientId);
        await tx.insert(patientVitals).values({
          id: vitalId,
          organizationId: actor.orgId,
          branchId,
          patientId,
          systolicBp: dto.systolicBp ?? null,
          diastolicBp: dto.diastolicBp ?? null,
          heartRateBpm: dto.heartRateBpm ?? null,
          temperatureTenthsC:
            dto.temperatureC !== undefined ? Math.round(dto.temperatureC * 10) : null,
          respiratoryRate: dto.respiratoryRate ?? null,
          spo2Percent: dto.spo2Percent ?? null,
          weightGrams: dto.weightKg !== undefined ? Math.round(dto.weightKg * 1000) : null,
          heightMm: dto.heightCm !== undefined ? Math.round(dto.heightCm * 10) : null,
          notesEncrypted,
          recordedByUserId: actor.sub,
        });
      },
    );

    const bmi =
      dto.weightKg && dto.heightCm
        ? Number((dto.weightKg / Math.pow(dto.heightCm / 100, 2)).toFixed(1))
        : null;

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: actor.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'EMR_VITALS_RECORDED',
      resourceType: 'patient_vitals',
      resourceId: vitalId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { patientId },
    });

    return { vitalId, patientId, bmi };
  }

  async recordAllergy(
    actor: AccessTokenClaims,
    patientId: string,
    dto: RecordAllergyDto,
    meta: RequestMeta,
  ) {
    const allergyId = randomUUID();
    const detailsEncrypted = await this.crypto.cipher.encryptJson(
      { allergen: dto.allergen, reaction: dto.reaction },
      {
        organizationId: actor.orgId,
        tableName: 'patient_allergies',
        recordId: allergyId,
        fieldName: 'details',
      },
    );

    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        await this.assertActivePatient(tx, actor.orgId, patientId);
        await tx.insert(patientAllergies).values({
          id: allergyId,
          organizationId: actor.orgId,
          patientId,
          category: dto.category,
          severity: dto.severity,
          detailsEncrypted,
          recordedByUserId: actor.sub,
        });
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: actor.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'EMR_ALLERGY_RECORDED',
      resourceType: 'patient_allergy',
      resourceId: allergyId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { patientId, severity: dto.severity },
    });

    return { allergyId, patientId };
  }

  async recordMedicationHistory(
    actor: AccessTokenClaims,
    patientId: string,
    dto: RecordMedicationHistoryDto,
    meta: RequestMeta,
  ) {
    const entryId = randomUUID();
    const detailsEncrypted = await this.crypto.cipher.encryptJson(dto, {
      organizationId: actor.orgId,
      tableName: 'patient_medication_history',
      recordId: entryId,
      fieldName: 'details',
    });

    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(patientMedicationHistory).values({
          id: entryId,
          organizationId: actor.orgId,
          patientId,
          isCurrent: dto.isCurrent,
          detailsEncrypted,
          recordedByUserId: actor.sub,
        });
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: actor.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'EMR_MED_HISTORY_RECORDED',
      resourceType: 'patient_medication_history',
      resourceId: entryId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { patientId, isCurrent: dto.isCurrent },
    });

    return { entryId, patientId };
  }

  async updateConsent(
    actor: AccessTokenClaims,
    patientId: string,
    dto: UpdateConsentDto,
    meta: RequestMeta,
  ) {
    const consentId = randomUUID();
    const notesEncrypted = dto.notes
      ? await this.crypto.cipher.encryptString(dto.notes, {
          organizationId: actor.orgId,
          tableName: 'patient_consents',
          recordId: consentId,
          fieldName: 'notes',
        })
      : null;

    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        await tx
          .insert(patientConsents)
          .values({
            id: consentId,
            organizationId: actor.orgId,
            patientId,
            consentType: dto.consentType,
            granted: dto.granted,
            scopeDepartment: dto.scopeDepartment ?? null,
            notesEncrypted,
            recordedByUserId: actor.sub,
          })
          .onConflictDoUpdate({
            target: [
              patientConsents.organizationId,
              patientConsents.patientId,
              patientConsents.consentType,
              patientConsents.scopeDepartment,
            ],
            set: {
              granted: dto.granted,
              notesEncrypted,
              recordedByUserId: actor.sub,
              updatedAt: new Date(),
            },
          });
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: actor.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'PATIENT_CONSENT_UPDATED',
      resourceType: 'patient_consent',
      resourceId: patientId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { consentType: dto.consentType, granted: dto.granted },
    });

    return { patientId, consentType: dto.consentType, granted: dto.granted };
  }

  async createReferral(
    actor: AccessTokenClaims,
    patientId: string,
    dto: CreateReferralDto,
    meta: RequestMeta,
  ) {
    if (!actor.branchId) {
      throw new BadRequestException('Branch context is required to create a referral.');
    }
    const fromBranchId = actor.branchId;
    const referralId = randomUUID();
    const clinicalSummaryEncrypted = await this.crypto.cipher.encryptJson(
      { reason: dto.reason, clinicalSummary: dto.clinicalSummary ?? null },
      {
        organizationId: actor.orgId,
        tableName: 'patient_referrals',
        recordId: referralId,
        fieldName: 'clinical_summary',
      },
    );

    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: fromBranchId, actorId: actor.sub },
      async (tx) => {
        await this.assertActivePatient(tx, actor.orgId, patientId);
        await tx.insert(patientReferrals).values({
          id: referralId,
          organizationId: actor.orgId,
          fromBranchId,
          toBranchId: dto.toBranchId ?? null,
          patientId,
          fromDepartment: dto.fromDepartment,
          toDepartment: dto.toDepartment,
          externalFacility: dto.externalFacility ?? null,
          clinicalSummaryEncrypted,
          referredByUserId: actor.sub,
        });
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: actor.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'PATIENT_REFERRAL_CREATED',
      resourceType: 'patient_referral',
      resourceId: referralId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { patientId, from: dto.fromDepartment, to: dto.toDepartment },
    });

    return { referralId, patientId, status: 'PENDING' };
  }

  async mergeDuplicatePatients(actor: AccessTokenClaims, dto: MergePatientsDto, meta: RequestMeta) {
    if (dto.primaryPatientId === dto.duplicatePatientId) {
      throw new BadRequestException('Primary and duplicate patient IDs must be different.');
    }

    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: actor.branchId, actorId: actor.sub },
      async (tx) => {
        const [primary] = await tx
          .select()
          .from(patients)
          .where(and(eq(patients.id, dto.primaryPatientId), eq(patients.status, 'ACTIVE')))
          .limit(1);
        const [duplicate] = await tx
          .select()
          .from(patients)
          .where(and(eq(patients.id, dto.duplicatePatientId), eq(patients.status, 'ACTIVE')))
          .limit(1);

        if (!primary || !duplicate) {
          throw new NotFoundException('Both primary and duplicate active patients must exist.');
        }

        await tx
          .update(patientVitals)
          .set({ patientId: dto.primaryPatientId })
          .where(eq(patientVitals.patientId, dto.duplicatePatientId));

        await tx
          .update(patientAllergies)
          .set({ patientId: dto.primaryPatientId })
          .where(eq(patientAllergies.patientId, dto.duplicatePatientId));

        await tx
          .update(patientMedicationHistory)
          .set({ patientId: dto.primaryPatientId })
          .where(eq(patientMedicationHistory.patientId, dto.duplicatePatientId));

        await tx
          .update(patientAttachments)
          .set({ patientId: dto.primaryPatientId })
          .where(eq(patientAttachments.patientId, dto.duplicatePatientId));

        await tx
          .update(patientReferrals)
          .set({ patientId: dto.primaryPatientId })
          .where(eq(patientReferrals.patientId, dto.duplicatePatientId));

        await tx
          .update(patients)
          .set({
            status: 'MERGED',
            mergedIntoPatientId: dto.primaryPatientId,
            updatedAt: new Date(),
          })
          .where(eq(patients.id, dto.duplicatePatientId));
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: actor.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'PATIENT_RECORDS_MERGED',
      resourceType: 'patient',
      resourceId: dto.primaryPatientId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        duplicatePatientId: dto.duplicatePatientId,
        reason: dto.reason,
      },
    });

    return {
      primaryPatientId: dto.primaryPatientId,
      mergedDuplicateId: dto.duplicatePatientId,
    };
  }
}
