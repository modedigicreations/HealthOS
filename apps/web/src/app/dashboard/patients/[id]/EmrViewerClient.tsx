'use client';

import { useState, type FormEvent } from 'react';

interface EmrData {
  id: string;
  patientNumber: string;
  bloodGroup: string;
  genotype: string;
  demographics: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    phone: string;
    email?: string;
  };
  medicalHistorySummary: string | null;
  vitals: Array<{
    id: string;
    systolicBp: number | null;
    diastolicBp: number | null;
    heartRateBpm: number | null;
    spo2Percent: number | null;
    recordedAt: string;
  }>;
  allergies: Array<{
    id: string;
    category: string;
    severity: string;
    details: { allergen: string; reaction: string };
  }>;
}

export function EmrViewerClient({ initialEmr, canWrite }: { initialEmr: EmrData; canWrite: boolean }) {
  const [emr, setEmr] = useState(initialEmr);
  const [systolicBp, setSystolicBp] = useState('120');
  const [diastolicBp, setDiastolicBp] = useState('80');
  const [heartRateBpm, setHeartRateBpm] = useState('72');
  const [spo2Percent, setSpo2Percent] = useState('99');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function handleRecordVitals(e: FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    const res = await fetch(`/api/patients/${emr.id}/vitals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systolicBp: Number(systolicBp),
        diastolicBp: Number(diastolicBp),
        heartRateBpm: Number(heartRateBpm),
        spo2Percent: Number(spo2Percent),
      }),
    });
    if (res.ok) {
      const refreshed = await fetch(`/api/patients/${emr.id}/emr`);
      if (refreshed.ok) setEmr(await refreshed.json());
      setStatusMsg('Vitals recorded and audit-logged.');
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--secure)', fontWeight: 700 }}>
          DECRYPTED EMR • {emr.patientNumber}
        </div>
        <h2 style={{ margin: '0.25rem 0 0.75rem' }}>
          {emr.demographics.firstName} {emr.demographics.lastName}
        </h2>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
          DOB: {emr.demographics.dateOfBirth} • Gender: {emr.demographics.gender} • Blood:{' '}
          {emr.bloodGroup} • Genotype: {emr.genotype} • Phone: {emr.demographics.phone}
        </p>
      </section>

      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem' }}>
        <h3 style={{ margin: '0 0 0.75rem' }}>Allergies ({emr.allergies.length})</h3>
        {emr.allergies.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>No recorded allergies.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {emr.allergies.map((a) => (
              <li key={a.id}>
                <strong>{a.details.allergen}</strong> ({a.category}, {a.severity}) — {a.details.reaction}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem' }}>
        <h3 style={{ margin: '0 0 0.75rem' }}>Vital Signs</h3>
        {canWrite && (
          <form onSubmit={handleRecordVitals} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <input
              type="number"
              aria-label="Systolic BP"
              value={systolicBp}
              onChange={(e) => setSystolicBp(e.target.value)}
              placeholder="Sys BP"
              style={{ width: 90, padding: '0.4rem', borderRadius: 6, border: '1px solid var(--border)' }}
            />
            <input
              type="number"
              aria-label="Diastolic BP"
              value={diastolicBp}
              onChange={(e) => setDiastolicBp(e.target.value)}
              placeholder="Dia BP"
              style={{ width: 90, padding: '0.4rem', borderRadius: 6, border: '1px solid var(--border)' }}
            />
            <input
              type="number"
              aria-label="Heart Rate"
              value={heartRateBpm}
              onChange={(e) => setHeartRateBpm(e.target.value)}
              placeholder="HR"
              style={{ width: 80, padding: '0.4rem', borderRadius: 6, border: '1px solid var(--border)' }}
            />
            <input
              type="number"
              aria-label="SpO2 Percent"
              value={spo2Percent}
              onChange={(e) => setSpo2Percent(e.target.value)}
              placeholder="SpO2 %"
              style={{ width: 80, padding: '0.4rem', borderRadius: 6, border: '1px solid var(--border)' }}
            />
            <button
              type="submit"
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: 6,
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Record Vitals
            </button>
          </form>
        )}
        {statusMsg && <p style={{ color: 'var(--secure)', fontSize: '0.875rem' }}>{statusMsg}</p>}
        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
          {emr.vitals.map((v) => (
            <li key={v.id}>
              BP: {v.systolicBp ?? '-'}/{v.diastolicBp ?? '-'} mmHg • HR: {v.heartRateBpm ?? '-'} bpm • SpO2:{' '}
              {v.spo2Percent ?? '-'}% ({new Date(v.recordedAt).toLocaleString()})
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
