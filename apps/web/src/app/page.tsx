import Link from 'next/link';
import { UserRoleSchema } from '@healthos/contracts';

const MODULES = [
  { id: 1, name: 'Patient Management & EMR', status: 'Next' },
  { id: 2, name: 'Appointment, Consultation & Clinical', status: 'Planned' },
  { id: 3, name: 'Laboratory Information Management', status: 'Planned' },
  { id: 4, name: 'Pharmacy & Medical Inventory', status: 'Planned' },
  { id: 5, name: 'Procurement & Supplier Management', status: 'Planned' },
  { id: 6, name: 'Billing, Payments & Finance', status: 'Planned' },
  { id: 7, name: 'Staff & Human Resource Management', status: 'Planned' },
  { id: 8, name: 'Regulatory Compliance & QA', status: 'Planned' },
  { id: 9, name: 'Equipment & Facility Management', status: 'Planned' },
  { id: 10, name: 'Patient Engagement & Communication', status: 'Planned' },
  { id: 11, name: 'Reporting, Analytics & BI', status: 'Planned' },
  { id: 12, name: 'Multi-Branch & Organisation Management', status: 'Planned' },
];

export default function HomePage() {
  const roles = UserRoleSchema.options;

  return (
    <main style={{ maxWidth: 1120, margin: '0 auto', padding: '2.5rem 1.5rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <p
          style={{
            margin: 0,
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--secure)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Security Core Active • AES-256-GCM Envelope + PostgreSQL RLS + SHA-256 Audit Chain
        </p>
        <h1 style={{ margin: '0.5rem 0', fontSize: '2rem' }}>
          HealthOS — All-in-One Healthcare Management System
        </h1>
        <p style={{ margin: '0 0 1.25rem', color: 'var(--muted)' }}>
          MODE Digital Creations Limited • {MODULES.length} Interconnected Modules • {roles.length}{' '}
          RBAC Roles
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link
            href="/login"
            style={{
              padding: '0.625rem 1.25rem',
              borderRadius: 8,
              background: 'var(--accent)',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Sign In (MFA)
          </Link>
          <Link
            href="/dashboard"
            style={{
              padding: '0.625rem 1.25rem',
              borderRadius: 8,
              border: '1px solid var(--border)',
              color: 'var(--text)',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Open Clinical Workspace
          </Link>
        </div>
      </header>

      <section aria-labelledby="modules-heading">
        <h2 id="modules-heading" style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
          Platform Modules
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '1rem',
          }}
        >
          {MODULES.map((mod) => (
            <article
              key={mod.id}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '1rem 1.25rem',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>
                MODULE {mod.id}
              </div>
              <h3 style={{ margin: '0.25rem 0 0.5rem', fontSize: '1rem' }}>{mod.name}</h3>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: mod.status === 'Next' ? 'var(--accent)' : 'var(--muted)',
                }}
              >
                {mod.status}
              </span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
