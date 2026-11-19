-- HealthOS Module 7: Staff & Human Resource Management RLS

ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY staff_profiles_tenant_isolation ON staff_profiles
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE staff_licences ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_licences FORCE ROW LEVEL SECURITY;
CREATE POLICY staff_licences_tenant_isolation ON staff_licences
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE staff_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_shifts FORCE ROW LEVEL SECURITY;
CREATE POLICY staff_shifts_tenant_isolation ON staff_shifts
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE staff_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_attendance FORCE ROW LEVEL SECURITY;
CREATE POLICY staff_attendance_tenant_isolation ON staff_attendance
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE staff_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_leaves FORCE ROW LEVEL SECURITY;
CREATE POLICY staff_leaves_tenant_isolation ON staff_leaves
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE staff_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_tasks FORCE ROW LEVEL SECURITY;
CREATE POLICY staff_tasks_tenant_isolation ON staff_tasks
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);
