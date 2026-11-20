'use client';

import { useState, type FormEvent } from 'react';

export default function HrPage() {
  const [branchId, setBranchId] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function clock(action: 'CLOCK_IN' | 'CLOCK_OUT') {
    setStatusMsg(null);
    const res = await fetch('/api/proxy/v1/hr/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId, action }),
    });
    const data = await res.json();
    setStatusMsg(res.ok ? `Recorded ${data.action} (${data.attendanceId})` : data.message ?? 'Error');
  }

  return (
    <main style={{ display: 'grid', gap: '1.5rem' }}>
      <header>
        <h1 style={{ margin: '0 0 0.25rem' }}>Module 7: Staff & Human Resource Management</h1>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          Staff profiles, encrypted professional licences, shift rosters, attendance, and leave workflows.
        </p>
      </header>

      {statusMsg && (
        <div role="status" style={{ padding: '0.75rem', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {statusMsg}
        </div>
      )}

      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Shift Attendance</h2>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            clock('CLOCK_IN');
          }}
          style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}
        >
          <input required placeholder="Branch UUID" value={branchId} onChange={(e) => setBranchId(e.target.value)} style={{ flex: 1, minWidth: 240, padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <button type="submit" style={{ padding: '0.5rem 1rem', borderRadius: 6, border: 'none', background: 'var(--secure)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            Clock In
          </button>
          <button type="button" onClick={() => clock('CLOCK_OUT')} style={{ padding: '0.5rem 1rem', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 600, cursor: 'pointer' }}>
            Clock Out
          </button>
        </form>
      </section>
    </main>
  );
}
