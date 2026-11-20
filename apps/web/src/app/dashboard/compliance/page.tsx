'use client';

import { useState, type FormEvent } from 'react';

export default function CompliancePage() {
  const [branchId, setBranchId] = useState('');
  const [category, setCategory] = useState('INFECTION_CONTROL');
  const [severity, setSeverity] = useState('MEDIUM');
  const [description, setDescription] = useState('');
  const [chainResult, setChainResult] = useState<{ valid: boolean; checkedCount: number } | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function verifyChain() {
    setStatusMsg(null);
    const res = await fetch('/api/proxy/v1/compliance/audit-chain/verify');
    const data = await res.json();
    if (res.ok) setChainResult(data);
    else setStatusMsg(data.message ?? 'Verification failed');
  }

  async function reportIncident(e: FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    const res = await fetch('/api/proxy/v1/compliance/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId, category, severity, description }),
    });
    const data = await res.json();
    setStatusMsg(res.ok ? `Encrypted incident report logged: ${data.incidentId}` : data.message ?? 'Error');
  }

  return (
    <main style={{ display: 'grid', gap: '1.5rem' }}>
      <header>
        <h1 style={{ margin: '0 0 0.25rem' }}>Module 8: Regulatory Compliance & QA</h1>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          Tamper-evident SHA-256 audit chain verification, jurisdiction checklists, and encrypted incident reporting.
        </p>
      </header>

      {statusMsg && (
        <div role="status" style={{ padding: '0.75rem', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {statusMsg}
        </div>
      )}

      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem' }}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>Cryptographic Audit Trail Integrity</h2>
        <button type="button" onClick={verifyChain} style={{ padding: '0.6rem 1.1rem', borderRadius: 6, border: 'none', background: 'var(--secure)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
          Verify SHA-256 Audit Chain
        </button>
        {chainResult && (
          <p style={{ marginTop: '0.75rem', fontWeight: 600, color: chainResult.valid ? 'var(--secure)' : '#ef4444' }}>
            {chainResult.valid
              ? `VALID — Verified ${chainResult.checkedCount} immutable audit entries.`
              : `TAMPER DETECTED at entry ${chainResult.checkedCount}`}
          </p>
        )}
      </section>

      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Report Incident / Adverse Event</h2>
        <form onSubmit={reportIncident} style={{ display: 'grid', gap: '0.75rem' }}>
          <input required placeholder="Branch UUID" value={branchId} onChange={(e) => setBranchId(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }}>
              <option value="INFECTION_CONTROL">Infection Control</option>
              <option value="CLINICAL">Clinical</option>
              <option value="MEDICATION_ERROR">Medication Error</option>
              <option value="SECURITY">Security</option>
            </select>
            <select aria-label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
          <textarea required rows={3} placeholder="Encrypted incident description..." value={description} onChange={(e) => setDescription(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <button type="submit" style={{ width: 'fit-content', padding: '0.5rem 1rem', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            Submit Incident
          </button>
        </form>
      </section>
    </main>
  );
}
