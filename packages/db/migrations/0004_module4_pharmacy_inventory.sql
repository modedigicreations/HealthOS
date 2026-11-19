-- HealthOS Module 4: Pharmacy & Medical Inventory Management RLS

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items FORCE ROW LEVEL SECURITY;
CREATE POLICY inventory_items_tenant_isolation ON inventory_items
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_batches FORCE ROW LEVEL SECURITY;
CREATE POLICY inventory_batches_tenant_isolation ON inventory_batches
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements FORCE ROW LEVEL SECURITY;
CREATE POLICY stock_movements_tenant_isolation ON stock_movements
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE dispense_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispense_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY dispense_logs_tenant_isolation ON dispense_logs
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);
