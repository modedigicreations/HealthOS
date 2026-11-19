-- HealthOS Module 10: Patient Engagement & Communication RLS

ALTER TABLE patient_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_notifications FORCE ROW LEVEL SECURITY;
CREATE POLICY patient_notifications_tenant_isolation ON patient_notifications
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE secure_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE secure_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY secure_messages_tenant_isolation ON secure_messages
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE patient_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_surveys FORCE ROW LEVEL SECURITY;
CREATE POLICY patient_surveys_tenant_isolation ON patient_surveys
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);

ALTER TABLE health_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_announcements FORCE ROW LEVEL SECURITY;
CREATE POLICY health_announcements_tenant_isolation ON health_announcements
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), '')::uuid);
