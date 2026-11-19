-- HealthOS Module 5: Procurement & Supplier Management RLS

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers FORCE ROW LEVEL SECURITY;
CREATE POLICY suppliers_tenant_isolation ON suppliers
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE purchase_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_requisitions FORCE ROW LEVEL SECURITY;
CREATE POLICY purchase_requisitions_tenant_isolation ON purchase_requisitions
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE rfq_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfq_quotes FORCE ROW LEVEL SECURITY;
CREATE POLICY rfq_quotes_tenant_isolation ON rfq_quotes
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders FORCE ROW LEVEL SECURITY;
CREATE POLICY purchase_orders_tenant_isolation ON purchase_orders
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE goods_received_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_received_notes FORCE ROW LEVEL SECURITY;
CREATE POLICY goods_received_notes_tenant_isolation ON goods_received_notes
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_invoices FORCE ROW LEVEL SECURITY;
CREATE POLICY supplier_invoices_tenant_isolation ON supplier_invoices
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);
