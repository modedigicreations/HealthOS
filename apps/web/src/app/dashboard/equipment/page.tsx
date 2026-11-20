'use client';

import { useState, type FormEvent } from 'react';

export default function EquipmentPage() {
  const [branchId, setBranchId] = useState('');
  const [assetTag, setAssetTag] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('LABORATORY');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function registerAsset(e: FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    const res = await fetch('/api/proxy/v1/equipment/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId, assetTag, name, department }),
    });
    const data = await res.json();
    setStatusMsg(res.ok ? `Registered asset ${data.assetTag} (${data.equipmentId})` : data.message ?? 'Error');
  }

  return (
    <main style={{ display: 'grid', gap: '1.5rem' }}>
      <header>
        <h1 style={{ margin: '0 0 0.25rem' }}>Module 9: Equipment & Facility Management</h1>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          Asset tagging, preventive maintenance, calibration tracking, and breakdown tickets.
        </p>
      </header>

      {statusMsg && (
        <div role="status" style={{ padding: '0.75rem', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {statusMsg}
        </div>
      )}

      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Register Medical Equipment</h2>
        <form onSubmit={registerAsset} style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <input required placeholder="Branch UUID" value={branchId} onChange={(e) => setBranchId(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <input required placeholder="Asset Tag (e.g. EQ-LAB-01)" value={assetTag} onChange={(e) => setAssetTag(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <input required placeholder="Equipment Name" value={name} onChange={(e) => setName(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <input required placeholder="Department" value={department} onChange={(e) => setDepartment(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <button type="submit" style={{ padding: '0.5rem 1rem', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            Register Asset
          </button>
        </form>
      </section>
    </main>
  );
}
