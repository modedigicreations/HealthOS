'use client';

import { useState, type FormEvent } from 'react';

export default function LabPage() {
  const [branchId, setBranchId] = useState('');
  const [patientId, setPatientId] = useState('');
  const [testId, setTestId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [specimenType, setSpecimenType] = useState('SERUM');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function createOrder(e: FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    const res = await fetch('/api/proxy/v1/lab/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId, patientId, testId, priority: 'ROUTINE' }),
    });
    const data = await res.json();
    if (res.ok) {
      setOrderId(data.orderId);
      setStatusMsg(`Lab order created: ${data.orderId}`);
    } else {
      setStatusMsg(data.message ?? 'Failed to create lab order');
    }
  }

  async function registerSample(e: FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    const res = await fetch('/api/proxy/v1/lab/samples', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, specimenType }),
    });
    const data = await res.json();
    setStatusMsg(res.ok ? `Sample registered • Barcode: ${data.sampleBarcode}` : data.message ?? 'Error');
  }

  return (
    <main style={{ display: 'grid', gap: '1.5rem' }}>
      <header>
        <h1 style={{ margin: '0 0 0.25rem' }}>Module 3: Laboratory Information Management (LIMS)</h1>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          Electronic lab orders, barcode/QR sample tracking, encrypted results, and qualified sign-off.
        </p>
      </header>

      {statusMsg && (
        <div role="status" style={{ padding: '0.75rem', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {statusMsg}
        </div>
      )}

      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Create Lab Order</h2>
        <form onSubmit={createOrder} style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <input required placeholder="Branch UUID" value={branchId} onChange={(e) => setBranchId(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <input required placeholder="Patient UUID" value={patientId} onChange={(e) => setPatientId(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <input required placeholder="Lab Test UUID" value={testId} onChange={(e) => setTestId(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <button type="submit" style={{ padding: '0.5rem 1rem', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            Order Lab Test
          </button>
        </form>
      </section>

      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Register Sample & Generate Barcode/QR</h2>
        <form onSubmit={registerSample} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input required placeholder="Lab Order UUID" value={orderId} onChange={(e) => setOrderId(e.target.value)} style={{ flex: 1, minWidth: 220, padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <input required placeholder="Specimen Type" value={specimenType} onChange={(e) => setSpecimenType(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <button type="submit" style={{ padding: '0.5rem 1rem', borderRadius: 6, border: 'none', background: 'var(--secure)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            Register Sample
          </button>
        </form>
      </section>
    </main>
  );
}
