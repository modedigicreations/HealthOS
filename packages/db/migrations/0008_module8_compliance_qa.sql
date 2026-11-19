-- HealthOS Module 8: Regulatory Compliance & Quality Assurance RLS

ALTER TABLE compliance_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_checklists FORCE ROW LEVEL SECURITY;
CREATE POLICY compliance_checklists_tenant_isolation ON compliance_checklists
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE facility_licences ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_licences FORCE ROW LEVEL SECURITY;
CREATE POLICY facility_licences_tenant_isolation ON facility_licences
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE sop_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sop_documents FORCE ROW LEVEL SECURITY;
CREATE POLICY sop_documents_tenant_isolation ON sop_documents
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_reports FORCE ROW LEVEL SECURITY;
CREATE POLICY incident_reports_tenant_isolation ON incident_reports
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE capa_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE capa_actions FORCE ROW LEVEL SECURITY;
CREATE POLICY capa_actions_tenant_isolation ON capa_actions
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);
