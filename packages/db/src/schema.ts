import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  bigserial,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * Organizations (Healthcare groups or standalone facilities).
 */
export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  jurisdiction: text('jurisdiction').notNull().default('NG'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Branches (Individual hospitals, clinics, diagnostic labs under an organization).
 */
export const branches = pgTable(
  'branches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    code: text('code').notNull(),
    facilityType: text('facility_type').notNull().default('CLINIC'), // HOSPITAL | CLINIC | LAB | PHARMACY
    addressEncrypted: text('address_encrypted'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('branches_org_code_idx').on(t.organizationId, t.code),
    index('branches_org_idx').on(t.organizationId),
  ],
);

/**
 * Users (Staff & Patient portal accounts).
 * PII fields (email, phone, fullName) are envelope-encrypted; emailBlindIndex allows lookup.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    emailEncrypted: text('email_encrypted').notNull(),
    emailBlindIndex: text('email_blind_index').notNull(),
    fullNameEncrypted: text('full_name_encrypted').notNull(),
    role: text('role').notNull(), // Matches UserRole in @healthos/contracts
    passwordHash: text('password_hash').notNull(),
    mfaEnabled: boolean('mfa_enabled').notNull().default(false),
    mfaSecretEncrypted: text('mfa_secret_encrypted'),
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('users_org_email_blind_idx').on(t.organizationId, t.emailBlindIndex),
    index('users_org_idx').on(t.organizationId),
  ],
);

/**
 * Branch-level user access assignments.
 */
export const userBranchAccess = pgTable(
  'user_branch_access',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'cascade' }),
    department: text('department'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('user_branch_unique_idx').on(t.userId, t.branchId),
    index('user_branch_org_idx').on(t.organizationId),
  ],
);

/**
 * Rotating refresh tokens with device/IP binding and revocation.
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('refresh_tokens_user_idx').on(t.userId)],
);

/**
 * Immutable, tamper-evident hash-chained Audit Log.
 * Protected by PostgreSQL trigger blocking UPDATE and DELETE.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    sequenceId: bigserial('sequence_id', { mode: 'bigint' }).primaryKey(),
    organizationId: uuid('organization_id').notNull(),
    branchId: uuid('branch_id'),
    actorId: uuid('actor_id'),
    actorRole: text('actor_role'),
    action: text('action').notNull(), // e.g., PHI_READ, PHI_WRITE, AUTH_LOGIN, BREAK_GLASS
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    metadataHash: text('metadata_hash').notNull(),
    prevHash: text('prev_hash').notNull(),
    entryHash: text('entry_hash').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('audit_logs_org_time_idx').on(t.organizationId, t.occurredAt),
    index('audit_logs_actor_idx').on(t.actorId),
    index('audit_logs_resource_idx').on(t.resourceType, t.resourceId),
  ],
);

// ============================================================================
// MODULE 1: Patient Management & Electronic Medical Records (EMR)
// ============================================================================

export const patients = pgTable(
  'patients',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id),
    patientNumber: text('patient_number').notNull(),
    status: text('status').notNull().default('ACTIVE'), // ACTIVE | MERGED | INACTIVE
    mergedIntoPatientId: uuid('merged_into_patient_id'),
    portalUserId: uuid('portal_user_id').references(() => users.id),

    // Envelope-encrypted PHI & PII (AES-256-GCM bound to org|patients|id|field)
    demographicsEncrypted: text('demographics_encrypted').notNull(),
    emergencyContactsEncrypted: text('emergency_contacts_encrypted'),
    medicalHistoryEncrypted: text('medical_history_encrypted'),

    // Organization-scoped HMAC-SHA256 blind indexes for searchable encrypted fields
    phoneBlindIndex: text('phone_blind_index').notNull(),
    emailBlindIndex: text('email_blind_index'),
    nationalIdBlindIndex: text('national_id_blind_index'),

    bloodGroup: text('blood_group').notNull().default('UNKNOWN'),
    genotype: text('genotype').notNull().default('UNKNOWN'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('patients_org_number_idx').on(t.organizationId, t.patientNumber),
    index('patients_org_phone_blind_idx').on(t.organizationId, t.phoneBlindIndex),
    index('patients_org_email_blind_idx').on(t.organizationId, t.emailBlindIndex),
    index('patients_org_nid_blind_idx').on(t.organizationId, t.nationalIdBlindIndex),
  ],
);

export const patientVitals = pgTable(
  'patient_vitals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    systolicBp: integer('systolic_bp'),
    diastolicBp: integer('diastolic_bp'),
    heartRateBpm: integer('heart_rate_bpm'),
    temperatureTenthsC: integer('temperature_tenths_c'),
    respiratoryRate: integer('respiratory_rate'),
    spo2Percent: integer('spo2_percent'),
    weightGrams: integer('weight_grams'),
    heightMm: integer('height_mm'),
    notesEncrypted: text('notes_encrypted'),
    recordedByUserId: uuid('recorded_by_user_id')
      .notNull()
      .references(() => users.id),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('patient_vitals_patient_idx').on(t.organizationId, t.patientId, t.recordedAt)],
);

export const patientAllergies = pgTable(
  'patient_allergies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    category: text('category').notNull(),
    severity: text('severity').notNull(),
    detailsEncrypted: text('details_encrypted').notNull(),
    recordedByUserId: uuid('recorded_by_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('patient_allergies_patient_idx').on(t.organizationId, t.patientId)],
);

export const patientMedicationHistory = pgTable(
  'patient_medication_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    isCurrent: boolean('is_current').notNull().default(true),
    detailsEncrypted: text('details_encrypted').notNull(),
    recordedByUserId: uuid('recorded_by_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('patient_med_history_patient_idx').on(t.organizationId, t.patientId)],
);

export const patientAttachments = pgTable(
  'patient_attachments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    category: text('category').notNull(), // LAB_DOC | SCAN | REFERRAL | CONSENT_FORM | OTHER
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    sha256Checksum: text('sha256_checksum').notNull(),
    storageKeyEncrypted: text('storage_key_encrypted').notNull(),
    metadataEncrypted: text('metadata_encrypted'),
    uploadedByUserId: uuid('uploaded_by_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('patient_attachments_patient_idx').on(t.organizationId, t.patientId)],
);

export const patientConsents = pgTable(
  'patient_consents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    consentType: text('consent_type').notNull(),
    granted: boolean('granted').notNull(),
    scopeDepartment: text('scope_department'),
    notesEncrypted: text('notes_encrypted'),
    recordedByUserId: uuid('recorded_by_user_id')
      .notNull()
      .references(() => users.id),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('patient_consents_unique_idx').on(
      t.organizationId,
      t.patientId,
      t.consentType,
      t.scopeDepartment,
    ),
  ],
);

export const patientReferrals = pgTable(
  'patient_referrals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    fromBranchId: uuid('from_branch_id')
      .notNull()
      .references(() => branches.id),
    toBranchId: uuid('to_branch_id').references(() => branches.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    fromDepartment: text('from_department').notNull(),
    toDepartment: text('to_department').notNull(),
    externalFacility: text('external_facility'),
    status: text('status').notNull().default('PENDING'), // PENDING | ACCEPTED | COMPLETED | CANCELLED
    clinicalSummaryEncrypted: text('clinical_summary_encrypted').notNull(),
    referredByUserId: uuid('referred_by_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('patient_referrals_patient_idx').on(t.organizationId, t.patientId)],
);

// ============================================================================
// MODULE 2: Appointment, Consultation & Clinical Management
// ============================================================================

export const doctorProfiles = pgTable(
  'doctor_profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    specialty: text('specialty').notNull(),
    licenceNumberEncrypted: text('licence_number_encrypted').notNull(),
    consultationFeeMinor: integer('consultation_fee_minor').notNull().default(0),
    telemedicineEnabled: boolean('telemedicine_enabled').notNull().default(false),
    bio: text('bio'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('doctor_profiles_org_user_idx').on(t.organizationId, t.userId)],
);

export const doctorSchedules = pgTable(
  'doctor_schedules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id),
    doctorUserId: uuid('doctor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    slotDurationMinutes: integer('slot_duration_minutes').notNull().default(20),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [index('doctor_schedules_doc_idx').on(t.organizationId, t.doctorUserId, t.dayOfWeek)],
);

export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    doctorUserId: uuid('doctor_user_id')
      .notNull()
      .references(() => users.id),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    bookingChannel: text('booking_channel').notNull().default('MANUAL'),
    visitType: text('visit_type').notNull().default('OUTPATIENT'),
    status: text('status').notNull().default('BOOKED'), // BOOKED | CHECKED_IN | IN_CONSULTATION | COMPLETED | CANCELLED | NO_SHOW
    queueNumber: integer('queue_number'),
    checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
    reasonEncrypted: text('reason_encrypted'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('appointments_org_branch_time_idx').on(t.organizationId, t.branchId, t.scheduledAt),
    index('appointments_doc_idx').on(t.organizationId, t.doctorUserId, t.status),
    index('appointments_patient_idx').on(t.organizationId, t.patientId),
  ],
);

export const clinicalTemplates = pgTable(
  'clinical_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    specialty: text('specialty').notNull(),
    sections: jsonb('sections').$type<Array<Record<string, unknown>>>().notNull(),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('clinical_templates_org_idx').on(t.organizationId, t.specialty)],
);

export const consultations = pgTable(
  'consultations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id),
    appointmentId: uuid('appointment_id').references(() => appointments.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    doctorUserId: uuid('doctor_user_id')
      .notNull()
      .references(() => users.id),
    templateId: uuid('template_id').references(() => clinicalTemplates.id),
    diagnosisCode: text('diagnosis_code'),
    clinicalRecordEncrypted: text('clinical_record_encrypted').notNull(),
    followUpDate: timestamp('follow_up_date', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('consultations_patient_idx').on(t.organizationId, t.patientId, t.createdAt),
    index('consultations_doctor_idx').on(t.organizationId, t.doctorUserId, t.createdAt),
  ],
);

export const prescriptions = pgTable(
  'prescriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id),
    consultationId: uuid('consultation_id')
      .notNull()
      .references(() => consultations.id, { onDelete: 'cascade' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    doctorUserId: uuid('doctor_user_id')
      .notNull()
      .references(() => users.id),
    status: text('status').notNull().default('PENDING'), // PENDING | DISPENSED | PARTIAL | CANCELLED
    itemsEncrypted: text('items_encrypted').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('prescriptions_patient_idx').on(t.organizationId, t.patientId)],
);

export const medicalProcedures = pgTable(
  'medical_procedures',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    consultationId: uuid('consultation_id')
      .notNull()
      .references(() => consultations.id, { onDelete: 'cascade' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    procedureCode: text('procedure_code'),
    procedureName: text('procedure_name').notNull(),
    notesEncrypted: text('notes_encrypted'),
    performedByUserId: uuid('performed_by_user_id')
      .notNull()
      .references(() => users.id),
    performedAt: timestamp('performed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('medical_procedures_patient_idx').on(t.organizationId, t.patientId)],
);

export const wards = pgTable(
  'wards',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id),
    name: text('name').notNull(),
    wardType: text('ward_type').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('wards_branch_name_idx').on(t.organizationId, t.branchId, t.name)],
);

export const beds = pgTable(
  'beds',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    wardId: uuid('ward_id')
      .notNull()
      .references(() => wards.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    status: text('status').notNull().default('AVAILABLE'), // AVAILABLE | OCCUPIED | MAINTENANCE
  },
  (t) => [uniqueIndex('beds_ward_label_idx').on(t.wardId, t.label)],
);

export const admissions = pgTable(
  'admissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    attendingDoctorId: uuid('attending_doctor_id')
      .notNull()
      .references(() => users.id),
    bedId: uuid('bed_id')
      .notNull()
      .references(() => beds.id),
    status: text('status').notNull().default('ADMITTED'), // ADMITTED | DISCHARGED
    admissionReasonEncrypted: text('admission_reason_encrypted').notNull(),
    dischargeSummaryEncrypted: text('discharge_summary_encrypted'),
    dischargeDisposition: text('discharge_disposition'),
    admittedAt: timestamp('admitted_at', { withTimezone: true }).defaultNow().notNull(),
    dischargedAt: timestamp('discharged_at', { withTimezone: true }),
  },
  (t) => [
    index('admissions_patient_idx').on(t.organizationId, t.patientId),
    index('admissions_status_idx').on(t.organizationId, t.branchId, t.status),
  ],
);

// ============================================================================
// MODULE 3: Laboratory Information Management (LIMS)
// ============================================================================

export const labTests = pgTable(
  'lab_tests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    specimenType: text('specimen_type').notNull(),
    priceMinor: integer('price_minor').notNull().default(0),
    turnaroundMinutes: integer('turnaround_minutes').notNull().default(120),
    referenceRanges: jsonb('reference_ranges').$type<Array<Record<string, unknown>>>().notNull().default([]),
    autoCalculationRule: text('auto_calculation_rule').notNull().default('NONE'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('lab_tests_org_code_idx').on(t.organizationId, t.code)],
);

export const labOrders = pgTable(
  'lab_orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    consultationId: uuid('consultation_id').references(() => consultations.id),
    testId: uuid('test_id')
      .notNull()
      .references(() => labTests.id),
    orderedByUserId: uuid('ordered_by_user_id')
      .notNull()
      .references(() => users.id),
    priority: text('priority').notNull().default('ROUTINE'),
    status: text('status').notNull().default('REQUESTED'), // REQUESTED | SAMPLE_COLLECTED | PROCESSING | RESULT_ENTERED | AUTHORIZED | CANCELLED
    paymentStatus: text('payment_status').notNull().default('UNPAID'), // UNPAID | PAID | WAIVED
    externalReferralLab: text('external_referral_lab'),
    clinicalNotesEncrypted: text('clinical_notes_encrypted'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('lab_orders_patient_idx').on(t.organizationId, t.patientId, t.createdAt),
    index('lab_orders_status_idx').on(t.organizationId, t.branchId, t.status),
  ],
);

export const labSamples = pgTable(
  'lab_samples',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id),
    orderId: uuid('order_id')
      .notNull()
      .references(() => labOrders.id, { onDelete: 'cascade' }),
    sampleBarcode: text('sample_barcode').notNull(),
    qrPayload: text('qr_payload').notNull(),
    specimenType: text('specimen_type').notNull(),
    status: text('status').notNull().default('COLLECTED'), // COLLECTED | RECEIVED | PROCESSING | REJECTED
    rejectionReason: text('rejection_reason'),
    collectedByUserId: uuid('collected_by_user_id')
      .notNull()
      .references(() => users.id),
    assignedTechnicianId: uuid('assigned_technician_id').references(() => users.id),
    collectedAt: timestamp('collected_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('lab_samples_org_barcode_idx').on(t.organizationId, t.sampleBarcode),
    index('lab_samples_order_idx').on(t.orderId),
  ],
);

export const labResults = pgTable(
  'lab_results',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id),
    orderId: uuid('order_id')
      .notNull()
      .references(() => labOrders.id, { onDelete: 'cascade' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    resultPayloadEncrypted: text('result_payload_encrypted').notNull(),
    status: text('status').notNull().default('PENDING_AUTHORIZATION'), // PENDING_AUTHORIZATION | AUTHORIZED
    enteredByUserId: uuid('entered_by_user_id')
      .notNull()
      .references(() => users.id),
    authorizedByUserId: uuid('authorized_by_user_id').references(() => users.id),
    digitalSignatureHash: text('digital_signature_hash'),
    enteredAt: timestamp('entered_at', { withTimezone: true }).defaultNow().notNull(),
    authorizedAt: timestamp('authorized_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('lab_results_order_idx').on(t.orderId),
    index('lab_results_patient_idx').on(t.organizationId, t.patientId),
  ],
);

export const labQcRecords = pgTable(
  'lab_qc_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id),
    equipmentName: text('equipment_name').notNull(),
    controlLot: text('control_lot').notNull(),
    passed: boolean('passed').notNull(),
    notes: text('notes'),
    recordedByUserId: uuid('recorded_by_user_id')
      .notNull()
      .references(() => users.id),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('lab_qc_org_branch_idx').on(t.organizationId, t.branchId, t.recordedAt)],
);

export const labReagents = pgTable(
  'lab_reagents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id),
    name: text('name').notNull(),
    lotNumber: text('lot_number').notNull(),
    quantityRemaining: integer('quantity_remaining').notNull(),
    reorderLevel: integer('reorder_level').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('lab_reagents_org_branch_idx').on(t.organizationId, t.branchId)],
);



