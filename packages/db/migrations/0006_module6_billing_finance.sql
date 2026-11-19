-- HealthOS Module 6: Billing, Payments & Financial Management RLS

ALTER TABLE service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_catalog FORCE ROW LEVEL SECURITY;
CREATE POLICY service_catalog_tenant_isolation ON service_catalog
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;
CREATE POLICY invoices_tenant_isolation ON invoices
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items FORCE ROW LEVEL SECURITY;
CREATE POLICY invoice_line_items_tenant_isolation ON invoice_line_items
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;
CREATE POLICY payments_tenant_isolation ON payments
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE hmo_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE hmo_claims FORCE ROW LEVEL SECURITY;
CREATE POLICY hmo_claims_tenant_isolation ON hmo_claims
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);
