'use client';

import { useState, type FormEvent } from 'react';

export default function ProcurementPage() {
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function registerSupplier(e: FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    const res = await fetch('/api/proxy/v1/procurement/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        category: 'PHARMACEUTICALS',
        contactName,
        contactEmail,
        contactPhone,
      }),
    });
    const data = await res.json();
    setStatusMsg(res.ok ? `Supplier registered: ${data.supplierId} (PENDING)` : data.message ?? 'Error');
  }

  return (
    <main style={{ display: 'grid', gap: '1.5rem' }}>
      <header>
        <h1 style={{ margin: '0 0 0.25rem' }}>Module 5: Procurement & Supplier Management</h1>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          Verified supplier directory, RFQs, PO approvals, GRNs, and automated stock reorder recommendations.
        </p>
      </header>

      {statusMsg && (
        <div role="status" style={{ padding: '0.75rem', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {statusMsg}
        </div>
      )}

      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Register Supplier (Encrypted Contact/Bank)</h2>
        <form onSubmit={registerSupplier} style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <input required placeholder="Supplier Name" value={name} onChange={(e) => setName(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <input required placeholder="Contact Name" value={contactName} onChange={(e) => setContactName(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <input required type="email" placeholder="Contact Email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <input required placeholder="Contact Phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <button type="submit" style={{ padding: '0.5rem 1rem', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            Register Supplier
          </button>
        </form>
      </section>
    </main>
  );
}
