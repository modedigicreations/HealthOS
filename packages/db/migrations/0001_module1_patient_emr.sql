-- HealthOS Module 1: Patient Management & EMR Row-Level Security (RLS)

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients FORCE ROW LEVEL SECURITY;
CREATE POLICY patients_tenant_isolation ON patients
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE patient_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_vitals FORCE ROW LEVEL SECURITY;
CREATE POLICY patient_vitals_tenant_isolation ON patient_vitals
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE patient_allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_allergies FORCE ROW LEVEL SECURITY;
CREATE POLICY patient_allergies_tenant_isolation ON patient_allergies
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE patient_medication_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_medication_history FORCE ROW LEVEL SECURITY;
CREATE POLICY patient_med_history_tenant_isolation ON patient_medication_history
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE patient_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_attachments FORCE ROW LEVEL SECURITY;
CREATE POLICY patient_attachments_tenant_isolation ON patient_attachments
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE patient_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_consents FORCE ROW LEVEL SECURITY;
CREATE POLICY patient_consents_tenant_isolation ON patient_consents
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE patient_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_referrals FORCE ROW LEVEL SECURITY;
CREATE POLICY patient_referrals_tenant_isolation ON patient_referrals
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);
