import { hasPermission } from '@healthos/contracts';
import { getSessionUser } from '../../../lib/session';
import { PatientWorkspaceClient } from './PatientWorkspaceClient';

export default async function PatientsPage() {
  const session = await getSessionUser();
  if (!session) return null;

  const canCreate = hasPermission(session.user.role, 'patient:create');

  return (
    <main>
      <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.75rem' }}>Patient Management & EMR</h1>
      <p style={{ margin: '0 0 1.5rem', color: 'var(--muted)' }}>
        All patient PII and clinical histories are protected by AES-256-GCM envelope encryption and
        audit-logged on every access.
      </p>
      <PatientWorkspaceClient canCreate={canCreate} />
    </main>
  );
}
