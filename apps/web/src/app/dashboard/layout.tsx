import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { hasPermission, type Permission } from '@healthos/contracts';
import { getSessionUser } from '../../lib/session';
import { LogoutButton } from '../../components/LogoutButton';

interface NavItem {
  href: string;
  label: string;
  permission?: Permission;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/patients', label: '1. Patients & EMR', permission: 'patient:read' },
  { href: '/dashboard/clinical', label: '2. Clinical & Queue', permission: 'appointment:read' },
  { href: '/dashboard/lab', label: '3. Laboratory (LIMS)', permission: 'lab:order' },
  { href: '/dashboard/pharmacy', label: '4. Pharmacy & Stock', permission: 'inventory:read' },
  { href: '/dashboard/procurement', label: '5. Procurement', permission: 'procurement:requisition' },
  { href: '/dashboard/billing', label: '6. Billing & HMO', permission: 'billing:read' },
  { href: '/dashboard/hr', label: '7. Staff & HR', permission: 'hr:read' },
  { href: '/dashboard/compliance', label: '8. Compliance & Audit', permission: 'compliance:read' },
  { href: '/dashboard/equipment', label: '9. Equipment & Facility', permission: 'equipment:read' },
  { href: '/dashboard/engagement', label: '10. Engagement', permission: 'engagement:communicate' },
  { href: '/dashboard/analytics', label: '11. Analytics & BI', permission: 'analytics:read' },
  { href: '/dashboard/organization', label: '12. Multi-Branch', permission: 'branch:manage' },
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSessionUser();
  if (!session) {
    redirect('/login');
  }

  const allowedNav = NAV_ITEMS.filter(
    (item) => !item.permission || hasPermission(session.user.role, item.permission),
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', minHeight: '100vh' }}>
      <aside
        aria-label="Primary navigation"
        style={{
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          padding: '1.25rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>HealthOS</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--secure)', fontWeight: 600 }}>
              {session.user.role} {session.user.mfaVerified ? '• MFA' : ''}
            </div>
          </div>

          <nav style={{ display: 'grid', gap: '0.35rem' }}>
            {allowedNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: 6,
                  textDecoration: 'none',
                  color: 'var(--text)',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <LogoutButton />
      </aside>

      <div style={{ padding: '2rem', maxWidth: 1200 }}>{children}</div>
    </div>
  );
}
