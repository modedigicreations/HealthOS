import Link from 'next/link';
import { hasPermission } from '@healthos/contracts';
import { getApiBaseUrl, getSessionUser } from '../../lib/session';

export default async function DashboardPage() {
  const session = await getSessionUser();
  if (!session) return null;

  let kpis: {
    patients?: { totalRegistered: number };
    clinical?: { totalAppointments: number; totalConsultations: number };
    laboratory?: { totalOrders: number };
  } | null = null;

  if (hasPermission(session.user.role, 'analytics:read')) {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/analytics/dashboard`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        cache: 'no-store',
      });
      if (res.ok) kpis = await res.json();
    } catch {
      kpis = null;
    }
  }

  return (
    <main>
      <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.75rem' }}>Clinical & Operations Workspace</h1>
      <p style={{ margin: '0 0 1.5rem', color: 'var(--muted)' }}>
        Role: <strong>{session.user.role}</strong> • Organization ID: <code>{session.user.orgId}</code>
      </p>

      {kpis && (
        <section
          aria-label="Key metrics"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>REGISTERED PATIENTS</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{kpis.patients?.totalRegistered ?? 0}</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>APPOINTMENTS</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{kpis.clinical?.totalAppointments ?? 0}</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>CONSULTATIONS</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{kpis.clinical?.totalConsultations ?? 0}</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>LAB ORDERS</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{kpis.laboratory?.totalOrders ?? 0}</div>
          </div>
        </section>
      )}

      <section>
        <h2 style={{ fontSize: '1.125rem', marginBottom: '0.75rem' }}>Quick Actions</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {hasPermission(session.user.role, 'patient:read') && (
            <Link
              href="/dashboard/patients"
              style={{
                padding: '0.75rem 1.25rem',
                borderRadius: 8,
                background: 'var(--accent)',
                color: '#fff',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Open Patient Management & EMR
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
