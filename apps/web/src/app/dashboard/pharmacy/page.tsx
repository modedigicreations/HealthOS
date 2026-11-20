'use client';

import { useState, type FormEvent } from 'react';

export default function PharmacyPage() {
  const [branchId, setBranchId] = useState('');
  const [patientId, setPatientId] = useState('');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('10');
  const [overrideReason, setOverrideReason] = useState('');
  const [alerts, setAlerts] = useState<string[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function dispense(e: FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    setAlerts([]);
    const res = await fetch('/api/proxy/v1/pharmacy/dispense', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branchId,
        patientId,
        itemId,
        quantity: Number(quantity),
        overrideClinicalAlertReason: overrideReason || undefined,
      }),
    });
    const data = await res.json();
    if (res.status === 409 && Array.isArray(data.alerts)) {
      setAlerts(data.alerts);
      setStatusMsg(data.message);
      return;
    }
    setStatusMsg(res.ok ? `Dispensed (FEFO): ${data.dispenseIds?.join(', ')}` : data.message ?? 'Error');
  }

  return (
    <main style={{ display: 'grid', gap: '1.5rem' }}>
      <header>
        <h1 style={{ margin: '0 0 0.25rem' }}>Module 4: Pharmacy & Medical Inventory</h1>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          FEFO batch dispensing with automated patient allergy & drug-drug interaction safety checks.
        </p>
      </header>

      {statusMsg && (
        <div role="status" style={{ padding: '0.75rem', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {statusMsg}
        </div>
      )}

      {alerts.length > 0 && (
        <div role="alert" style={{ padding: '1rem', borderRadius: 8, background: 'rgba(220, 38, 38, 0.12)', color: '#ef4444' }}>
          <strong>Clinical Safety Alerts:</strong>
          <ul>
            {alerts.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Dispense Medication</h2>
        <form onSubmit={dispense} style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <input required placeholder="Branch UUID" value={branchId} onChange={(e) => setBranchId(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <input required placeholder="Patient UUID" value={patientId} onChange={(e) => setPatientId(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <input required placeholder="Inventory Item UUID" value={itemId} onChange={(e) => setItemId(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <input required type="number" min={1} placeholder="Quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <input placeholder="Override Reason (if alert)" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <button type="submit" style={{ padding: '0.5rem 1rem', borderRadius: 6, border: 'none', background: 'var(--secure)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            Dispense (FEFO)
          </button>
        </form>
      </section>
    </main>
  );
}
