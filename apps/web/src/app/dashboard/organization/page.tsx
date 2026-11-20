'use client';

import { useState, type FormEvent } from 'react';

export default function OrganizationPage() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [facilityType, setFacilityType] = useState('CLINIC');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function createBranch(e: FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    const res = await fetch('/api/proxy/v1/organization/branches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, code, facilityType }),
    });
    const data = await res.json();
    setStatusMsg(res.ok ? `Branch created: ${data.code} (${data.branchId})` : data.message ?? 'Error');
  }

  return (
    <main style={{ display: 'grid', gap: '1.5rem' }}>
      <header>
        <h1 style={{ margin: '0 0 0.25rem' }}>Module 12: Multi-Branch & Organisation Management</h1>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          Manage multiple hospitals, clinics, and diagnostic labs under one encrypted tenant account.
        </p>
      </header>

      {statusMsg && (
        <div role="status" style={{ padding: '0.75rem', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {statusMsg}
        </div>
      )}

      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Add Facility Branch</h2>
        <form onSubmit={createBranch} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input required placeholder="Branch Name" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1, minWidth: 200, padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <input required placeholder="Branch Code (e.g. ABJ)" value={code} onChange={(e) => setCode(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <select aria-label="Facility Type" value={facilityType} onChange={(e) => setFacilityType(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }}>
            <option value="CLINIC">Clinic</option>
            <option value="HOSPITAL">Hospital</option>
            <option value="LAB">Diagnostic Lab</option>
            <option value="PHARMACY">Pharmacy</option>
          </select>
          <button type="submit" style={{ padding: '0.5rem 1rem', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            Create Branch
          </button>
        </form>
      </section>
    </main>
  );
}
