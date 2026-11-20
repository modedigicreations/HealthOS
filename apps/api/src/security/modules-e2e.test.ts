import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { loadEnv } from '../common/env.js';
import { CryptoService, DbService, TokenService } from './security.module.js';
import { AuditService } from '../audit/audit.service.js';
import { AuthService } from '../auth/auth.service.js';
import { PatientsService } from '../patients/patients.service.js';
import { ClinicalService } from '../clinical/clinical.service.js';
import { LabService } from '../lab/lab.service.js';
import { PharmacyService } from '../pharmacy/pharmacy.service.js';
import { ProcurementService } from '../procurement/procurement.service.js';
import { BillingService } from '../billing/billing.service.js';
import { HrService } from '../hr/hr.service.js';
import { ComplianceService } from '../compliance/compliance.service.js';
import { EquipmentService } from '../equipment/equipment.service.js';
import { EngagementService } from '../engagement/engagement.service.js';
import { AnalyticsService } from '../analytics/analytics.service.js';
import { OrganizationService } from '../organization/organization.service.js';
import { AdvancedService } from '../advanced/advanced.service.js';

const E2E_DB_URL = process.env.HEALTHOS_E2E_DB_URL;

describe('HealthOS Modules 2-12 & Section 3 PostgreSQL E2E', { skip: !E2E_DB_URL }, () => {
  let dbService: DbService;
  let auth: AuthService;
  let patientsSvc: PatientsService;
  let clinical: ClinicalService;
  let lab: LabService;
  let pharmacy: PharmacyService;
  let procurement: ProcurementService;
  let billing: BillingService;
  let hr: HrService;
  let compliance: ComplianceService;
  let equipment: EquipmentService;
  let engagement: EngagementService;
  let analytics: AnalyticsService;
  let orgSvc: OrganizationService;
  let advanced: AdvancedService;

  before(() => {
    process.env.DATABASE_URL = E2E_DB_URL;
    const env = loadEnv();
    dbService = new DbService(env);
    const crypto = new CryptoService(env);
    const tokens = new TokenService(env);
    const audit = new AuditService(dbService);
    auth = new AuthService(env, dbService, crypto, tokens, audit);
    patientsSvc = new PatientsService(dbService, crypto, audit);
    clinical = new ClinicalService(dbService, crypto, audit);
    lab = new LabService(dbService, crypto, audit);
    pharmacy = new PharmacyService(dbService, crypto, audit);
    procurement = new ProcurementService(dbService, crypto, audit);
    billing = new BillingService(dbService, crypto, audit);
    hr = new HrService(dbService, crypto, audit);
    compliance = new ComplianceService(dbService, crypto, audit);
    equipment = new EquipmentService(dbService, audit);
    engagement = new EngagementService(dbService, crypto, audit);
    analytics = new AnalyticsService(dbService);
    orgSvc = new OrganizationService(dbService, crypto, audit);
    advanced = new AdvancedService(dbService, crypto, audit);
  });

  after(async () => {
    await dbService.onModuleDestroy();
  });

  it('executes end-to-end workflows across Modules 2-12 and Section 3 with IDOR & concurrency checks', async () => {
    const org = await auth.bootstrapOrganization(
      {
        organizationName: 'Mode Medical Group',
        organizationSlug: `mmg-${Date.now()}`,
        jurisdiction: 'NG',
        branchName: 'Lagos HQ',
        branchCode: 'LOS',
        adminEmail: 'director@mmg.org',
        adminFullName: 'Dr. Director',
        adminPassword: 'CorrectHorseBatteryStaple!99',
      },
      {},
    );

    const admin = {
      sub: org.superAdminUserId,
      orgId: org.organizationId,
      branchId: org.branchId,
      role: 'SUPER_ADMIN' as const,
      mfaVerified: true,
    };

    const patientReg = await patientsSvc.registerPatient(
      admin,
      {
        branchId: org.branchId,
        firstName: 'Chidi',
        lastName: 'Nwachukwu',
        dateOfBirth: '1988-09-20',
        gender: 'MALE',
        phone: '+2348055544433',
        bloodGroup: 'A+',
        genotype: 'AA',
        emergencyContacts: [],
      },
      {},
    );
    const patientId = patientReg.patientId;

    // Module 2: Appointment, Check-in, Consultation, Ward/Bed atomic admission & discharge
    const appt = await clinical.bookAppointment(
      admin,
      {
        branchId: org.branchId,
        patientId,
        doctorUserId: admin.sub,
        scheduledAt: new Date().toISOString(),
        bookingChannel: 'ONLINE',
        visitType: 'OUTPATIENT',
      },
      {},
    );
    const checkin = await clinical.checkInAppointment(admin, appt.appointmentId, {});
    assert.equal(checkin.queueNumber, 1);

    const consult = await clinical.createConsultation(
      admin,
      {
        appointmentId: appt.appointmentId,
        branchId: org.branchId,
        patientId,
        chiefComplaint: 'Chest tightness',
        diagnosisCode: 'R07',
        diagnosisDescription: 'Atypical chest pain',
        prescriptions: [
          {
            medicationName: 'Amoxicillin',
            dosage: '500mg',
            frequency: 'TID',
            durationDays: 5,
            quantity: 15,
          },
        ],
        procedures: [],
      },
      {},
    );
    assert.ok(consult.consultationId);

    const ward = await clinical.createWard(admin, {
      branchId: org.branchId,
      name: 'ICU',
      wardType: 'ICU',
      bedLabels: ['ICU-1'],
    });
    const bedRow = ward.beds[0];
    assert.ok(bedRow);
    const admit = await clinical.admitPatient(
      admin,
      {
        branchId: org.branchId,
        patientId,
        attendingDoctorId: admin.sub,
        bedId: bedRow.id,
        admissionReason: 'Observation',
      },
      {},
    );
    // Double admission to same bed must fail
    await assert.rejects(() =>
      clinical.admitPatient(
        admin,
        {
          branchId: org.branchId,
          patientId,
          attendingDoctorId: admin.sub,
          bedId: bedRow.id,
          admissionReason: 'Duplicate',
        },
        {},
      ),
    );
    await clinical.dischargePatient(
      admin,
      admit.admissionId,
      { dischargeSummary: 'Stable on discharge', dischargeDisposition: 'HOME' },
      {},
    );

    // Module 3: LIMS with auto-calculation & SHA-256 authorization + PATIENT IDOR check
    const testDef = await lab.createTest(admin, {
      code: 'LIPID',
      name: 'Lipid Profile',
      category: 'BIOCHEM',
      specimenType: 'SERUM',
      priceMinor: 1500000,
      turnaroundMinutes: 90,
      referenceRanges: [],
      autoCalculationRule: 'LDL_FRIEDEWALD',
    });
    const order = await lab.createOrder(
      admin,
      { branchId: org.branchId, patientId, testId: testDef.testId, priority: 'ROUTINE' },
      {},
    );
    const sample = await lab.registerSample(admin, { orderId: order.orderId, specimenType: 'SERUM' }, {});
    assert.ok(sample.sampleBarcode.startsWith('LAB-'));
    const resEntry = await lab.enterResult(
      admin,
      {
        orderId: order.orderId,
        parameters: [
          { name: 'Total Cholesterol', value: 200, unit: 'mg/dL' },
          { name: 'HDL', value: 50, unit: 'mg/dL' },
          { name: 'Triglycerides', value: 150, unit: 'mg/dL' },
        ],
      },
      {},
    );
    assert.equal(resEntry.parameters.find((p) => p.name === 'LDL (Calculated)')?.value, 120);
    await lab.authorizeResult(admin, resEntry.resultId, {});

    const intruderPatient = {
      sub: '99999999-9999-4999-8999-999999999999',
      orgId: org.organizationId,
      branchId: org.branchId,
      role: 'PATIENT' as const,
      mfaVerified: false,
    };
    await assert.rejects(() => lab.getPatientLabResults(intruderPatient, patientId, {}));

    // Module 4: Pharmacy allergy alert & FEFO dispensing
    await patientsSvc.recordAllergy(
      admin,
      patientId,
      { allergen: 'Penicillin', category: 'DRUG', severity: 'SEVERE', reaction: 'Anaphylaxis' },
      {},
    );
    const item = await pharmacy.createItem(admin, {
      sku: 'AMOX-500',
      name: 'Amoxicillin 500mg',
      itemType: 'MEDICINE',
      genericName: 'Penicillin',
      drugClass: 'PENICILLIN',
      unitOfMeasure: 'CAP',
      reorderLevel: 10,
      unitPriceMinor: 5000,
    });
    await pharmacy.receiveBatch(
      admin,
      {
        branchId: org.branchId,
        itemId: item.itemId,
        batchNumber: 'B-001',
        quantity: 30,
        unitCostMinor: 2500,
        expiresAt: new Date(Date.now() + 90 * 86_400_000).toISOString(),
      },
      {},
    );
    // Blocked without override reason
    await assert.rejects(() =>
      pharmacy.dispenseMedication(
        admin,
        { branchId: org.branchId, patientId, itemId: item.itemId, quantity: 5, isRefill: false },
        {},
      ),
    );
    // Succeeds with explicit clinical override
    await pharmacy.dispenseMedication(
      admin,
      {
        branchId: org.branchId,
        patientId,
        itemId: item.itemId,
        quantity: 5,
        isRefill: false,
        overrideClinicalAlertReason: 'Confirmed desensitization protocol',
      },
      {},
    );

    // Module 5: Procurement Supplier -> PO -> Approve -> GRN
    const sup = await procurement.registerSupplier(
      admin,
      {
        name: 'MedSupply Ltd',
        category: 'PHARMACEUTICALS',
        contactName: 'Tunde',
        contactEmail: 'tunde@medsupply.ng',
        contactPhone: '+2348011122233',
      },
      {},
    );
    await procurement.verifySupplier(admin, sup.supplierId, { verificationStatus: 'VERIFIED' }, {});
    const po = await procurement.createPurchaseOrder(
      admin,
      {
        branchId: org.branchId,
        supplierId: sup.supplierId,
        items: [{ inventoryItemId: item.itemId, description: 'Amox', quantity: 50, unitPriceMinor: 2000 }],
      },
      {},
    );
    await procurement.approvePurchaseOrder(admin, po.poId, {});
    await procurement.recordGrn(
      admin,
      {
        purchaseOrderId: po.poId,
        deliveryNoteNumber: 'DN-100',
        receivedItems: [{ inventoryItemId: item.itemId, batchNumber: 'B-002', quantityReceived: 50, unitCostMinor: 2000 }],
      },
      {},
    );

    // Module 6: Billing Unified Invoice, Idempotent Payment, Departmental Revenue & IDOR check
    const inv = await billing.createInvoice(
      admin,
      {
        branchId: org.branchId,
        patientId,
        items: [
          { department: 'CONSULTATION', description: 'Consult', quantity: 1, unitPriceMinor: 1000000 },
          { department: 'LABORATORY', description: 'Lipid', quantity: 1, unitPriceMinor: 1500000 },
        ],
        discountMinor: 0,
      },
      {},
    );
    const pay1 = await billing.recordPayment(
      admin,
      {
        branchId: org.branchId,
        patientId,
        invoiceId: inv.invoiceId,
        amountMinor: 2500000,
        paymentMethod: 'CARD',
        isDeposit: false,
        idempotencyKey: 'idem-key-123456',
      },
      {},
    );
    const pay2 = await billing.recordPayment(
      admin,
      {
        branchId: org.branchId,
        patientId,
        invoiceId: inv.invoiceId,
        amountMinor: 2500000,
        paymentMethod: 'CARD',
        isDeposit: false,
        idempotencyKey: 'idem-key-123456',
      },
      {},
    );
    assert.equal(pay1.paymentId, pay2.paymentId);
    assert.equal(pay2.duplicate, true);
    await assert.rejects(() => billing.getPatientStatement(intruderPatient, patientId));

    // Module 7: HR
    await hr.recordLicence(
      admin,
      {
        userId: admin.sub,
        licenceType: 'MDCN',
        issuingBody: 'MDCN',
        licenceNumber: 'MDCN-12345',
        issuedAt: '2026-01-01T00:00:00.000Z',
        expiresAt: new Date(Date.now() + 15 * 86_400_000).toISOString(),
      },
      {},
    );
    const expiring = await hr.getExpiringLicences(admin, 30);
    assert.equal(expiring.length, 1);

    // Module 8 & 9 & 10
    await compliance.reportIncident(
      admin,
      { branchId: org.branchId, category: 'CLINICAL', severity: 'LOW', description: 'Minor slip' },
      {},
    );
    await equipment.registerEquipment(
      admin,
      { branchId: org.branchId, assetTag: 'EQ-01', name: 'Centrifuge', department: 'LAB' },
      {},
    );
    await engagement.submitSurvey(admin, { branchId: org.branchId, patientId, rating: 5 });
    await assert.rejects(() => engagement.getPatientMessages(intruderPatient, patientId));

    // Module 11 & 12
    const dash = await analytics.getExecutiveDashboard(admin);
    assert.equal(dash.patients.totalRegistered, 1);
    assert.equal(dash.finance.totalCollectedMinor, 2500000);

    await orgSvc.createBranch(admin, { name: 'Abuja Clinic', code: 'ABJ', facilityType: 'CLINIC' }, {});
    const comparison = await orgSvc.getBranchComparison(admin);
    assert.equal(comparison.length, 2);

    // Section 3: AI Assistant, FHIR R4 + IDOR, Predictive BI
    const aiRev = await advanced.answerOperationsQuestion(admin, {
      question: 'Which department generated the most revenue?',
    });
    assert.equal(aiRev.intent, 'DEPARTMENT_REVENUE');
    const fhir = await advanced.exportFhirPatient(admin, patientId, {});
    assert.equal(fhir.resourceType, 'Patient');
    await assert.rejects(() => advanced.exportFhirPatient(intruderPatient, patientId, {}));
    const forecast = await advanced.getPredictiveForecast(admin);
    assert.equal(forecast.historicalCollectedMinor, 2500000);

    // Final SHA-256 audit chain integrity check across all 12 modules!
    const chain = await compliance.verifyAuditChain(admin);
    assert.equal(chain.valid, true);
    assert.ok(chain.checkedCount >= 12);
  });
});
