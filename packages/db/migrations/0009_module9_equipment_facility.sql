-- HealthOS Module 9: Equipment & Facility Management RLS

ALTER TABLE equipment_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_assets FORCE ROW LEVEL SECURITY;
CREATE POLICY equipment_assets_tenant_isolation ON equipment_assets
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE equipment_service_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_service_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY equipment_service_logs_tenant_isolation ON equipment_service_logs
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE maintenance_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_tickets FORCE ROW LEVEL SECURITY;
CREATE POLICY maintenance_tickets_tenant_isolation ON maintenance_tickets
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);
