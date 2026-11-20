-- Upgrade audit_logs immutability trigger to FOR EACH STATEMENT so even 0-row UPDATE/DELETE is rejected.
DROP TRIGGER IF EXISTS audit_logs_no_update ON audit_logs;
CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION prevent_audit_log_mutation();
