'use client';

import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      style={{
        width: '100%',
        padding: '0.5rem 0.75rem',
        borderRadius: 6,
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--text)',
        cursor: 'pointer',
        textAlign: 'left',
        fontSize: '0.875rem',
      }}
    >
      Sign Out (Clear Session)
    </button>
  );
}
