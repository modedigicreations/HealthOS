'use client';

import { useState, type FormEvent } from 'react';

export default function BillingPage() {
  const [branchId, setBranchId] = useState('');
  const [patientId, setPatientId] = useState('');
  const [description, setDescription] = useState('Specialist Consultation');
  const [department, setDepartment] = useState('CONSULTATION');
  const [unitPriceMinor, setUnitPriceMinor] = useState('1500000');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function createInvoice(e: FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    const res = await fetch('/api/proxy/v1/billing/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branchId,
        patientId,
        items: [{ department, description, quantity: 1, unitPriceMinor: Number(unitPriceMinor) }],
      }),
    });
    const data = await res.json();
    setStatusMsg(
      res.ok ? `Invoice ${data.invoiceNumber} created (${data.totalMinor} minor)` : data.message ?? 'Error',
    );
  }

  return (
    <main style={{ display: 'grid', gap: '1.5rem' }}>
      <header>
        <h1 style={{ margin: '0 0 0.25rem' }}>Module 6: Billing, Payments & Financial Management</h1>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          Unified multi-department invoicing, idempotent payments, refunds, and HMO claims reconciliation.
        </p>
      </header>

      {statusMsg && (
        <div role="status" style={{ padding: '0.75rem', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {statusMsg}
        </div>
      )}

      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Create Unified Patient Invoice</h2>
        <form onSubmit={createInvoice} style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <input required placeholder="Branch UUID" value={branchId} onChange={(e) => setBranchId(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <input required placeholder="Patient UUID" value={patientId} onChange={(e) => setPatientId(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <select aria-label="Department" value={department} onChange={(e) => setDepartment(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }}>
            <option value="CONSULTATION">Consultation</option>
            <option value="LABORATORY">Laboratory</option>
            <option value="PHARMACY">Pharmacy</option>
            <option value="PROCEDURE">Procedure</option>
            <option value="ADMISSION_BED">Admission & Bed</option>
          </select>
          <input required placeholder="Line Item Description" value={description} onChange={(e) => setDescription(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <input required type="number" min={0} placeholder="Unit Price (minor)" value={unitPriceMinor} onChange={(e) => setUnitPriceMinor(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <button type="submit" style={{ padding: '0.5rem 1rem', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            Issue Invoice
          </button>
        </form>
      </section>
    </main>
  );
}
