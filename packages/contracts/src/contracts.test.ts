import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BookAppointmentSchema,
  BootstrapOrgSchema,
  CreateConsultationSchema,
  CreateInventoryItemSchema,
  CreateInvoiceSchema,
  CreateLabOrderSchema,
  CreateLabTestSchema,
  CreatePurchaseOrderSchema,
  CreateShiftSchema,
  CreateWardSchema,
  DispensePrescriptionSchema,
  EnterLabResultSchema,
  RecordPaymentSchema,
  RecordStaffLicenceSchema,
  RegisterPatientSchema,
  RegisterSupplierSchema,
  RecordVitalsSchema,
  SubmitHmoClaimSchema,
  TransferStockSchema,
  UpdateConsentSchema,
} from './index.js';

describe('@healthos/contracts Module 1 & Auth DTOs', () => {
  it('validates BootstrapOrgSchema and rejects weak passwords', () => {
    const bad = BootstrapOrgSchema.safeParse({
      organizationName: 'Mode General Hospital',
      organizationSlug: 'mode-general',
      branchName: 'Main Campus',
      branchCode: 'MAIN',
      adminEmail: 'admin@modehospital.org',
      adminFullName: 'Ada Lovelace',
      adminPassword: 'short',
    });
    assert.equal(bad.success, false);

    const good = BootstrapOrgSchema.safeParse({
      organizationName: 'Mode General Hospital',
      organizationSlug: 'mode-general',
      branchName: 'Main Campus',
      branchCode: 'MAIN',
      adminEmail: 'admin@modehospital.org',
      adminFullName: 'Ada Lovelace',
      adminPassword: 'CorrectHorseBatteryStaple!99',
    });
    assert.equal(good.success, true);
  });

  it('validates RegisterPatientSchema, RecordVitalsSchema, and UpdateConsentSchema', () => {
    const patient = RegisterPatientSchema.safeParse({
      branchId: '11111111-1111-4111-8111-111111111111',
      firstName: 'Chidi',
      lastName: 'Okafor',
      dateOfBirth: '1990-05-14',
      gender: 'MALE',
      phone: '+2348001234567',
      bloodGroup: 'O+',
      genotype: 'AA',
    });
    assert.equal(patient.success, true);

    const vitals = RecordVitalsSchema.safeParse({
      systolicBp: 120,
      diastolicBp: 80,
      heartRateBpm: 72,
      temperatureC: 36.8,
      spo2Percent: 99,
      weightKg: 74.5,
      heightCm: 178,
    });
    assert.equal(vitals.success, true);

    const consent = UpdateConsentSchema.safeParse({
      consentType: 'INTER_DEPARTMENT_SHARING',
      granted: true,
      scopeDepartment: 'LABORATORY',
    });
    assert.equal(consent.success, true);
  });

  it('validates Module 2 clinical DTOs (BookAppointment, CreateConsultation, CreateWard)', () => {
    const appt = BookAppointmentSchema.safeParse({
      branchId: '11111111-1111-4111-8111-111111111111',
      patientId: '22222222-2222-4222-8222-222222222222',
      doctorUserId: '33333333-3333-4333-8333-333333333333',
      scheduledAt: '2026-11-20T10:00:00.000Z',
      bookingChannel: 'ONLINE',
      visitType: 'TELEMEDICINE',
    });
    assert.equal(appt.success, true);

    const consult = CreateConsultationSchema.safeParse({
      branchId: '11111111-1111-4111-8111-111111111111',
      patientId: '22222222-2222-4222-8222-222222222222',
      chiefComplaint: 'Persistent headache for 3 days',
      diagnosisCode: 'R51',
      diagnosisDescription: 'Tension-type headache',
      prescriptions: [
        {
          medicationName: 'Paracetamol 500mg',
          dosage: '1000mg',
          frequency: 'TID',
          durationDays: 5,
          quantity: 30,
        },
      ],
    });
    assert.equal(consult.success, true);

    const ward = CreateWardSchema.safeParse({
      branchId: '11111111-1111-4111-8111-111111111111',
      name: 'General Medical Ward A',
      wardType: 'GENERAL',
      bedLabels: ['A-01', 'A-02', 'A-03'],
    });
    assert.equal(ward.success, true);
  });

  it('validates Module 3 LIMS DTOs (CreateLabTest, CreateLabOrder, EnterLabResult)', () => {
    const testDef = CreateLabTestSchema.safeParse({
      code: 'LIPID',
      name: 'Lipid Profile',
      category: 'BIOCHEMISTRY',
      specimenType: 'SERUM',
      priceMinor: 1500000,
      autoCalculationRule: 'LDL_FRIEDEWALD',
    });
    assert.equal(testDef.success, true);

    const order = CreateLabOrderSchema.safeParse({
      branchId: '11111111-1111-4111-8111-111111111111',
      patientId: '22222222-2222-4222-8222-222222222222',
      testId: '33333333-3333-4333-8333-333333333333',
      priority: 'URGENT',
    });
    assert.equal(order.success, true);

    const result = EnterLabResultSchema.safeParse({
      orderId: '44444444-4444-4444-8444-444444444444',
      parameters: [
        { name: 'Total Cholesterol', value: 200, unit: 'mg/dL', flag: 'NORMAL' },
        { name: 'HDL', value: 50, unit: 'mg/dL', flag: 'NORMAL' },
        { name: 'Triglycerides', value: 150, unit: 'mg/dL', flag: 'NORMAL' },
      ],
    });
    assert.equal(result.success, true);
  });

  it('validates Module 4 Pharmacy & Inventory DTOs', () => {
    const item = CreateInventoryItemSchema.safeParse({
      sku: 'MED-AMOX-500',
      name: 'Amoxicillin 500mg Capsules',
      itemType: 'MEDICINE',
      genericName: 'Amoxicillin',
      drugClass: 'PENICILLIN',
      reorderLevel: 50,
      unitPriceMinor: 25000,
    });
    assert.equal(item.success, true);

    const dispense = DispensePrescriptionSchema.safeParse({
      branchId: '11111111-1111-4111-8111-111111111111',
      patientId: '22222222-2222-4222-8222-222222222222',
      itemId: '33333333-3333-4333-8333-333333333333',
      quantity: 20,
      isRefill: false,
    });
    assert.equal(dispense.success, true);

    const transfer = TransferStockSchema.safeParse({
      fromBranchId: '11111111-1111-4111-8111-111111111111',
      toBranchId: '22222222-2222-4222-8222-222222222222',
      batchId: '33333333-3333-4333-8333-333333333333',
      quantity: 10,
    });
    assert.equal(transfer.success, true);
  });

  it('validates Module 5 Procurement DTOs', () => {
    const supplier = RegisterSupplierSchema.safeParse({
      name: 'MedSupply Africa Ltd',
      category: 'PHARMACEUTICALS',
      contactName: 'Tunde Bakare',
      contactEmail: 'orders@medsupply.ng',
      contactPhone: '+2348011112222',
    });
    assert.equal(supplier.success, true);

    const po = CreatePurchaseOrderSchema.safeParse({
      branchId: '11111111-1111-4111-8111-111111111111',
      supplierId: '22222222-2222-4222-8222-222222222222',
      items: [{ description: 'Surgical Gloves Box', quantity: 100, unitPriceMinor: 450000 }],
    });
    assert.equal(po.success, true);
  });

  it('validates Module 6 Billing & HMO DTOs', () => {
    const invoice = CreateInvoiceSchema.safeParse({
      branchId: '11111111-1111-4111-8111-111111111111',
      patientId: '22222222-2222-4222-8222-222222222222',
      items: [
        { department: 'CONSULTATION', description: 'GP Consultation', quantity: 1, unitPriceMinor: 1000000 },
        { department: 'LABORATORY', description: 'Lipid Profile', quantity: 1, unitPriceMinor: 1500000 },
        { department: 'PHARMACY', description: 'Amoxicillin 500mg', quantity: 20, unitPriceMinor: 25000 },
      ],
    });
    assert.equal(invoice.success, true);

    const payment = RecordPaymentSchema.safeParse({
      branchId: '11111111-1111-4111-8111-111111111111',
      patientId: '22222222-2222-4222-8222-222222222222',
      amountMinor: 3000000,
      paymentMethod: 'CARD',
      idempotencyKey: 'pay-idem-12345678',
    });
    assert.equal(payment.success, true);

    const claim = SubmitHmoClaimSchema.safeParse({
      branchId: '11111111-1111-4111-8111-111111111111',
      invoiceId: '33333333-3333-4333-8333-333333333333',
      patientId: '22222222-2222-4222-8222-222222222222',
      hmoProvider: 'Hygeia HMO',
      policyNumber: 'HYG-998877',
      claimedAmountMinor: 3000000,
    });
    assert.equal(claim.success, true);
  });

  it('validates Module 7 HR DTOs', () => {
    const licence = RecordStaffLicenceSchema.safeParse({
      userId: '11111111-1111-4111-8111-111111111111',
      licenceType: 'MDCN Practicing Licence',
      issuingBody: 'Medical and Dental Council of Nigeria',
      licenceNumber: 'MDCN/2026/99123',
      issuedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-12-31T23:59:59.000Z',
    });
    assert.equal(licence.success, true);

    const shift = CreateShiftSchema.safeParse({
      branchId: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      department: 'EMERGENCY',
      shiftType: 'NIGHT',
      startsAt: '2026-11-20T20:00:00.000Z',
      endsAt: '2026-11-21T08:00:00.000Z',
    });
    assert.equal(shift.success, true);
  });
});
