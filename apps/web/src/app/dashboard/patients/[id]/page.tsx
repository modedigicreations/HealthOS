import { hasPermission } from '@healthos/contracts';
import { getApiBaseUrl, getSessionUser } from '../../../../lib/session';
import { EmrViewerClient } from './EmrViewerClient';

export default async function PatientEmrPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionUser();
  if (!session) return null;

  const { id } = await params;
  const res = await fetch(`${getApiBaseUrl()}/api/v1/patients/${id}/emr`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    return (
      <main>
        <h1>EMR Unavailable</h1>
        <p style={{ color: 'var(--muted)' }}>
          Could not load patient record (status {res.status}).
        </p>
      </main>
    );
  }

  const emr = await res.json();
  const canWrite = hasPermission(session.user.role, 'emr:write');

  return (
    <main>
      <EmrViewerClient initialEmr={emr} canWrite={canWrite} />
    </main>
  );
}
