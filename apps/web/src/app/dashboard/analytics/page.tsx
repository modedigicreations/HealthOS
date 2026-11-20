import { getApiBaseUrl, getSessionUser } from '../../../lib/session';

export default async function AnalyticsPage() {
  const session = await getSessionUser();
  if (!session) return null;

  let data: {
    patients?: { totalRegistered: number };
    clinical?: { totalAppointments: number; totalConsultations: number };
    laboratory?: { totalOrders: number };
    finance?: {
      totalBilledMinor: number;
      totalCollectedMinor: number;
      outstandingMinor: number;
      hmoClaimedMinor: number;
      procurementSpendMinor: number;
    };
    operations?: {
      equipmentMaintenanceCostMinor: number;
      equipmentDowntimeMinutes: number;
      patientSatisfactionAvg: number;
      surveyResponses: number;
    };
  } | null = null;

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/v1/analytics/dashboard`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: 'no-store',
    });
    if (res.ok) data = await res.json();
  } catch {
    data = null;
  }

  return (
    <main style={{ display: 'grid', gap: '1.5rem' }}>
      <header>
        <h1 style={{ margin: '0 0 0.25rem' }}>Module 11: Reporting, Analytics & BI</h1>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          Real-time executive intelligence across clinical, laboratory, financial, procurement, and equipment KPIs.
        </p>
      </header>

      {!data ? (
        <p style={{ color: 'var(--muted)' }}>Connect to HealthOS API to view live executive KPIs.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>PATIENTS</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{data.patients?.totalRegistered ?? 0}</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>CONSULTATIONS</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{data.clinical?.totalConsultations ?? 0}</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>LAB ORDERS</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{data.laboratory?.totalOrders ?? 0}</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>COLLECTED REVENUE (MINOR)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{data.finance?.totalCollectedMinor ?? 0}</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>OUTSTANDING (MINOR)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{data.finance?.outstandingMinor ?? 0}</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>PATIENT SATISFACTION</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{data.operations?.patientSatisfactionAvg ?? 0} / 5</div>
          </div>
        </div>
      )}
    </main>
  );
}
