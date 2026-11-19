import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, asc, count, desc, eq, gte, sql } from 'drizzle-orm';
import type {
  AdmitPatientDto,
  BookAppointmentDto,
  CreateClinicalTemplateDto,
  CreateConsultationDto,
  CreateDoctorScheduleDto,
  CreateWardDto,
  DischargePatientDto,
  UpsertDoctorProfileDto,
} from '@healthos/contracts';
import {
  admissions,
  appointments,
  beds,
  clinicalTemplates,
  consultations,
  doctorProfiles,
  doctorSchedules,
  medicalProcedures,
  prescriptions,
  wards,
  withTenantContext,
} from '@healthos/db';
import { AuditService } from '../audit/audit.service.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { CryptoService, DbService, type AccessTokenClaims } from '../security/security.module.js';

export interface EncryptedClinicalRecord {
  chiefComplaint: string;
  examinationNotes?: string;
  diagnosisDescription: string;
  treatmentPlan?: string;
}

@Injectable()
export class ClinicalService {
  constructor(
    private readonly dbService: DbService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  async upsertDoctorProfile(
    actor: AccessTokenClaims,
    dto: UpsertDoctorProfileDto,
    meta: RequestMeta,
  ) {
    const profileId = randomUUID();
    const licenceNumberEncrypted = await this.crypto.cipher.encryptString(dto.licenceNumber, {
      organizationId: actor.orgId,
      tableName: 'doctor_profiles',
      recordId: dto.userId,
      fieldName: 'licence_number',
    });

    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        await tx
          .insert(doctorProfiles)
          .values({
            id: profileId,
            organizationId: actor.orgId,
            branchId: dto.branchId,
            userId: dto.userId,
            specialty: dto.specialty,
            licenceNumberEncrypted,
            consultationFeeMinor: dto.consultationFeeMinor,
            telemedicineEnabled: dto.telemedicineEnabled,
            bio: dto.bio ?? null,
          })
          .onConflictDoUpdate({
            target: [doctorProfiles.organizationId, doctorProfiles.userId],
            set: {
              branchId: dto.branchId,
              specialty: dto.specialty,
              licenceNumberEncrypted,
              consultationFeeMinor: dto.consultationFeeMinor,
              telemedicineEnabled: dto.telemedicineEnabled,
              bio: dto.bio ?? null,
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
      action: 'DOCTOR_PROFILE_UPSERTED',
      resourceType: 'doctor_profile',
      resourceId: dto.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { specialty: dto.specialty },
    });

    return { userId: dto.userId, specialty: dto.specialty };
  }

  async createDoctorSchedule(actor: AccessTokenClaims, dto: CreateDoctorScheduleDto) {
    const scheduleId = randomUUID();
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(doctorSchedules).values({
          id: scheduleId,
          organizationId: actor.orgId,
          branchId: dto.branchId,
          doctorUserId: dto.doctorUserId,
          dayOfWeek: dto.dayOfWeek,
          startTime: dto.startTime,
          endTime: dto.endTime,
          slotDurationMinutes: dto.slotDurationMinutes,
        });
      },
    );
    return { scheduleId };
  }

  async bookAppointment(actor: AccessTokenClaims, dto: BookAppointmentDto, meta: RequestMeta) {
    const appointmentId = randomUUID();
    const reasonEncrypted = dto.reason
      ? await this.crypto.cipher.encryptString(dto.reason, {
          organizationId: actor.orgId,
          tableName: 'appointments',
          recordId: appointmentId,
          fieldName: 'reason',
        })
      : null;

    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(appointments).values({
          id: appointmentId,
          organizationId: actor.orgId,
          branchId: dto.branchId,
          patientId: dto.patientId,
          doctorUserId: dto.doctorUserId,
          scheduledAt: new Date(dto.scheduledAt),
          bookingChannel: dto.bookingChannel,
          visitType: dto.visitType,
          status: 'BOOKED',
          reasonEncrypted,
          createdByUserId: actor.sub,
        });
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: dto.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'APPOINTMENT_BOOKED',
      resourceType: 'appointment',
      resourceId: appointmentId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { patientId: dto.patientId, doctorUserId: dto.doctorUserId, visitType: dto.visitType },
    });

    return { appointmentId, status: 'BOOKED' };
  }

  async checkInAppointment(actor: AccessTokenClaims, appointmentId: string, meta: RequestMeta) {
    const result = await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: actor.branchId, actorId: actor.sub },
      async (tx) => {
        const [appt] = await tx
          .select()
          .from(appointments)
          .where(and(eq(appointments.id, appointmentId), eq(appointments.organizationId, actor.orgId)))
          .limit(1);

        if (!appt) throw new NotFoundException('Appointment not found.');
        if (appt.status !== 'BOOKED') {
          throw new BadRequestException(`Cannot check in appointment in status ${appt.status}.`);
        }

        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);

        const [maxRow] = await tx
          .select({ maxQueue: sql<number>`coalesce(max(${appointments.queueNumber}), 0)` })
          .from(appointments)
          .where(
            and(
              eq(appointments.organizationId, actor.orgId),
              eq(appointments.branchId, appt.branchId),
              gte(appointments.checkedInAt, startOfDay),
            ),
          );

        const queueNumber = Number(maxRow?.maxQueue ?? 0) + 1;

        await tx
          .update(appointments)
          .set({
            status: 'CHECKED_IN',
            queueNumber,
            checkedInAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(appointments.id, appointmentId));

        return { appointmentId, queueNumber, branchId: appt.branchId };
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: result.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'APPOINTMENT_CHECKED_IN',
      resourceType: 'appointment',
      resourceId: appointmentId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { queueNumber: result.queueNumber },
    });

    return result;
  }

  async getBranchQueue(actor: AccessTokenClaims, branchId: string) {
    return withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId, actorId: actor.sub },
      async (tx) => {
        return tx
          .select({
            id: appointments.id,
            patientId: appointments.patientId,
            doctorUserId: appointments.doctorUserId,
            queueNumber: appointments.queueNumber,
            status: appointments.status,
            visitType: appointments.visitType,
            checkedInAt: appointments.checkedInAt,
          })
          .from(appointments)
          .where(
            and(
              eq(appointments.organizationId, actor.orgId),
              eq(appointments.branchId, branchId),
              eq(appointments.status, 'CHECKED_IN'),
            ),
          )
          .orderBy(asc(appointments.queueNumber));
      },
    );
  }

  async createClinicalTemplate(actor: AccessTokenClaims, dto: CreateClinicalTemplateDto) {
    const templateId = randomUUID();
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(clinicalTemplates).values({
          id: templateId,
          organizationId: actor.orgId,
          name: dto.name,
          specialty: dto.specialty,
          sections: dto.sections,
          createdByUserId: actor.sub,
        });
      },
    );
    return { templateId, name: dto.name };
  }

  async createConsultation(
    actor: AccessTokenClaims,
    dto: CreateConsultationDto,
    meta: RequestMeta,
  ) {
    const consultationId = randomUUID();
    const clinicalRecord: EncryptedClinicalRecord = {
      chiefComplaint: dto.chiefComplaint,
      examinationNotes: dto.examinationNotes,
      diagnosisDescription: dto.diagnosisDescription,
      treatmentPlan: dto.treatmentPlan,
    };

    const clinicalRecordEncrypted = await this.crypto.cipher.encryptJson(clinicalRecord, {
      organizationId: actor.orgId,
      tableName: 'consultations',
      recordId: consultationId,
      fieldName: 'clinical_record',
    });

    let prescriptionId: string | null = null;
    const itemsEncrypted =
      dto.prescriptions.length > 0
        ? await this.crypto.cipher.encryptJson(dto.prescriptions, {
            organizationId: actor.orgId,
            tableName: 'prescriptions',
            recordId: consultationId,
            fieldName: 'items',
          })
        : null;

    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(consultations).values({
          id: consultationId,
          organizationId: actor.orgId,
          branchId: dto.branchId,
          appointmentId: dto.appointmentId ?? null,
          patientId: dto.patientId,
          doctorUserId: actor.sub,
          templateId: dto.templateId ?? null,
          diagnosisCode: dto.diagnosisCode ?? null,
          clinicalRecordEncrypted,
          followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : null,
        });

        if (itemsEncrypted) {
          prescriptionId = randomUUID();
          await tx.insert(prescriptions).values({
            id: prescriptionId,
            organizationId: actor.orgId,
            branchId: dto.branchId,
            consultationId,
            patientId: dto.patientId,
            doctorUserId: actor.sub,
            itemsEncrypted,
          });
        }

        for (const proc of dto.procedures) {
          const procId = randomUUID();
          const notesEncrypted = proc.notes
            ? await this.crypto.cipher.encryptString(proc.notes, {
                organizationId: actor.orgId,
                tableName: 'medical_procedures',
                recordId: procId,
                fieldName: 'notes',
              })
            : null;
          await tx.insert(medicalProcedures).values({
            id: procId,
            organizationId: actor.orgId,
            consultationId,
            patientId: dto.patientId,
            procedureCode: proc.procedureCode ?? null,
            procedureName: proc.procedureName,
            notesEncrypted,
            performedByUserId: actor.sub,
          });
        }

        if (dto.appointmentId) {
          await tx
            .update(appointments)
            .set({ status: 'COMPLETED', updatedAt: new Date() })
            .where(eq(appointments.id, dto.appointmentId));
        }

        if (dto.followUpDate) {
          await tx.insert(appointments).values({
            organizationId: actor.orgId,
            branchId: dto.branchId,
            patientId: dto.patientId,
            doctorUserId: actor.sub,
            scheduledAt: new Date(dto.followUpDate),
            bookingChannel: 'MANUAL',
            visitType: 'FOLLOW_UP',
            status: 'BOOKED',
            createdByUserId: actor.sub,
          });
        }
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: dto.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'CONSULTATION_RECORDED',
      resourceType: 'consultation',
      resourceId: consultationId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        patientId: dto.patientId,
        prescriptionsCount: dto.prescriptions.length,
        proceduresCount: dto.procedures.length,
      },
    });

    return { consultationId, prescriptionId };
  }

  async getPatientConsultations(actor: AccessTokenClaims, patientId: string, meta: RequestMeta) {
    const rows = await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: actor.branchId, actorId: actor.sub },
      async (tx) => {
        return tx
          .select()
          .from(consultations)
          .where(and(eq(consultations.organizationId, actor.orgId), eq(consultations.patientId, patientId)))
          .orderBy(desc(consultations.createdAt))
          .limit(50);
      },
    );

    const decrypted = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        branchId: row.branchId,
        doctorUserId: row.doctorUserId,
        diagnosisCode: row.diagnosisCode,
        followUpDate: row.followUpDate,
        createdAt: row.createdAt,
        clinicalRecord: await this.crypto.cipher.decryptJson<EncryptedClinicalRecord>(
          row.clinicalRecordEncrypted,
          {
            organizationId: actor.orgId,
            tableName: 'consultations',
            recordId: row.id,
            fieldName: 'clinical_record',
          },
        ),
      })),
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: actor.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'PHI_CONSULTATIONS_READ',
      resourceType: 'patient',
      resourceId: patientId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { count: decrypted.length },
    });

    return decrypted;
  }

  async createWard(actor: AccessTokenClaims, dto: CreateWardDto) {
    const wardId = randomUUID();
    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        await tx.insert(wards).values({
          id: wardId,
          organizationId: actor.orgId,
          branchId: dto.branchId,
          name: dto.name,
          wardType: dto.wardType,
        });

        await tx.insert(beds).values(
          dto.bedLabels.map((label) => ({
            organizationId: actor.orgId,
            wardId,
            label,
            status: 'AVAILABLE',
          })),
        );
      },
    );

    return { wardId, bedCount: dto.bedLabels.length };
  }

  async admitPatient(actor: AccessTokenClaims, dto: AdmitPatientDto, meta: RequestMeta) {
    const admissionId = randomUUID();
    const admissionReasonEncrypted = await this.crypto.cipher.encryptString(dto.admissionReason, {
      organizationId: actor.orgId,
      tableName: 'admissions',
      recordId: admissionId,
      fieldName: 'admission_reason',
    });

    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: dto.branchId, actorId: actor.sub },
      async (tx) => {
        const [bed] = await tx
          .select()
          .from(beds)
          .where(and(eq(beds.id, dto.bedId), eq(beds.organizationId, actor.orgId)))
          .limit(1);

        if (!bed) throw new NotFoundException('Bed not found.');
        if (bed.status !== 'AVAILABLE') {
          throw new ConflictException(`Bed ${bed.label} is currently ${bed.status}.`);
        }

        await tx.update(beds).set({ status: 'OCCUPIED' }).where(eq(beds.id, bed.id));
        await tx.insert(admissions).values({
          id: admissionId,
          organizationId: actor.orgId,
          branchId: dto.branchId,
          patientId: dto.patientId,
          attendingDoctorId: dto.attendingDoctorId,
          bedId: dto.bedId,
          admissionReasonEncrypted,
        });
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: dto.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'PATIENT_ADMITTED',
      resourceType: 'admission',
      resourceId: admissionId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { patientId: dto.patientId, bedId: dto.bedId },
    });

    return { admissionId, status: 'ADMITTED' };
  }

  async dischargePatient(
    actor: AccessTokenClaims,
    admissionId: string,
    dto: DischargePatientDto,
    meta: RequestMeta,
  ) {
    const dischargeSummaryEncrypted = await this.crypto.cipher.encryptString(dto.dischargeSummary, {
      organizationId: actor.orgId,
      tableName: 'admissions',
      recordId: admissionId,
      fieldName: 'discharge_summary',
    });

    await withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: actor.branchId, actorId: actor.sub },
      async (tx) => {
        const [admission] = await tx
          .select()
          .from(admissions)
          .where(and(eq(admissions.id, admissionId), eq(admissions.organizationId, actor.orgId)))
          .limit(1);

        if (!admission) throw new NotFoundException('Admission record not found.');
        if (admission.status !== 'ADMITTED') {
          throw new BadRequestException('Patient is already discharged.');
        }

        await tx
          .update(admissions)
          .set({
            status: 'DISCHARGED',
            dischargeSummaryEncrypted,
            dischargeDisposition: dto.dischargeDisposition,
            dischargedAt: new Date(),
          })
          .where(eq(admissions.id, admissionId));

        await tx.update(beds).set({ status: 'AVAILABLE' }).where(eq(beds.id, admission.bedId));
      },
    );

    await this.audit.record({
      organizationId: actor.orgId,
      branchId: actor.branchId,
      actorId: actor.sub,
      actorRole: actor.role,
      action: 'PATIENT_DISCHARGED',
      resourceType: 'admission',
      resourceId: admissionId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { disposition: dto.dischargeDisposition },
    });

    return { admissionId, status: 'DISCHARGED' };
  }

  async getDoctorPerformanceReport(actor: AccessTokenClaims, branchId?: string) {
    return withTenantContext(
      this.dbService.db,
      { organizationId: actor.orgId, branchId: branchId ?? actor.branchId, actorId: actor.sub },
      async (tx) => {
        const conditions = [eq(consultations.organizationId, actor.orgId)];
        if (branchId) conditions.push(eq(consultations.branchId, branchId));

        return tx
          .select({
            doctorUserId: consultations.doctorUserId,
            totalConsultations: count(consultations.id),
          })
          .from(consultations)
          .where(and(...conditions))
          .groupBy(consultations.doctorUserId);
      },
    );
  }
}
