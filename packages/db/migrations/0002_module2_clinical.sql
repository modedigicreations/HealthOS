-- HealthOS Module 2: Appointment, Consultation & Clinical Management RLS

ALTER TABLE doctor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY doctor_profiles_tenant_isolation ON doctor_profiles
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE doctor_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_schedules FORCE ROW LEVEL SECURITY;
CREATE POLICY doctor_schedules_tenant_isolation ON doctor_schedules
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments FORCE ROW LEVEL SECURITY;
CREATE POLICY appointments_tenant_isolation ON appointments
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE clinical_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_templates FORCE ROW LEVEL SECURITY;
CREATE POLICY clinical_templates_tenant_isolation ON clinical_templates
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations FORCE ROW LEVEL SECURITY;
CREATE POLICY consultations_tenant_isolation ON consultations
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY prescriptions_tenant_isolation ON prescriptions
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE medical_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_procedures FORCE ROW LEVEL SECURITY;
CREATE POLICY medical_procedures_tenant_isolation ON medical_procedures
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE wards ENABLE ROW LEVEL SECURITY;
ALTER TABLE wards FORCE ROW LEVEL SECURITY;
CREATE POLICY wards_tenant_isolation ON wards
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE beds FORCE ROW LEVEL SECURITY;
CREATE POLICY beds_tenant_isolation ON beds
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admissions FORCE ROW LEVEL SECURITY;
CREATE POLICY admissions_tenant_isolation ON admissions
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);
