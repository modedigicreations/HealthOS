-- HealthOS Module 3: Laboratory Information Management (LIMS) RLS

ALTER TABLE lab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_tests FORCE ROW LEVEL SECURITY;
CREATE POLICY lab_tests_tenant_isolation ON lab_tests
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE lab_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_orders FORCE ROW LEVEL SECURITY;
CREATE POLICY lab_orders_tenant_isolation ON lab_orders
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE lab_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_samples FORCE ROW LEVEL SECURITY;
CREATE POLICY lab_samples_tenant_isolation ON lab_samples
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_results FORCE ROW LEVEL SECURITY;
CREATE POLICY lab_results_tenant_isolation ON lab_results
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE lab_qc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_qc_records FORCE ROW LEVEL SECURITY;
CREATE POLICY lab_qc_records_tenant_isolation ON lab_qc_records
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE lab_reagents ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_reagents FORCE ROW LEVEL SECURITY;
CREATE POLICY lab_reagents_tenant_isolation ON lab_reagents
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);
