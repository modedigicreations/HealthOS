'use client';

import { useState, type FormEvent } from 'react';

export default function ClinicalPage() {
  const [branchId, setBranchId] = useState('');
  const [patientId, setPatientId] = useState('');
  const [doctorUserId, setDoctorUserId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [visitType, setVisitType] = useState('OUTPATIENT');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [diagnosisDescription, setDiagnosisDescription] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function bookAppointment(e: FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    const res = await fetch('/api/proxy/v1/clinical/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branchId,
        patientId,
        doctorUserId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        bookingChannel: 'MANUAL',
        visitType,
      }),
    });
    const data = await res.json();
    setStatusMsg(res.ok ? `Appointment booked: ${data.appointmentId}` : data.message ?? 'Error');
  }

  async function recordConsultation(e: FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    const res = await fetch('/api/proxy/v1/clinical/consultations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branchId,
        patientId,
        chiefComplaint,
        diagnosisDescription,
      }),
    });
    const data = await res.json();
    setStatusMsg(
      res.ok ? `Consultation saved (encrypted): ${data.consultationId}` : data.message ?? 'Error',
    );
  }

  return (
    <main style={{ display: 'grid', gap: '1.5rem' }}>
      <header>
        <h1 style={{ margin: '0 0 0.25rem' }}>Module 2: Appointments, Consultation & Clinical</h1>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          Book appointments, manage check-in queues, and record encrypted clinical consultations.
        </p>
      </header>

      {statusMsg && (
        <div role="status" style={{ padding: '0.75rem', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {statusMsg}
        </div>
      )}

      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Book Appointment</h2>
        <form onSubmit={bookAppointment} style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <input required placeholder="Branch UUID" value={branchId} onChange={(e) => setBranchId(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <input required placeholder="Patient UUID" value={patientId} onChange={(e) => setPatientId(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <input required placeholder="Doctor User UUID" value={doctorUserId} onChange={(e) => setDoctorUserId(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <input required type="datetime-local" aria-label="Scheduled At" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <select aria-label="Visit Type" value={visitType} onChange={(e) => setVisitType(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }}>
            <option value="OUTPATIENT">Outpatient</option>
            <option value="INPATIENT">Inpatient</option>
            <option value="TELEMEDICINE">Telemedicine</option>
            <option value="FOLLOW_UP">Follow-up</option>
          </select>
          <button type="submit" style={{ padding: '0.5rem 1rem', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            Book Appointment
          </button>
        </form>
      </section>

      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Record Encrypted Consultation</h2>
        <form onSubmit={recordConsultation} style={{ display: 'grid', gap: '0.75rem' }}>
          <input required placeholder="Chief Complaint" value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <input required placeholder="Diagnosis Description" value={diagnosisDescription} onChange={(e) => setDiagnosisDescription(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <button type="submit" style={{ width: 'fit-content', padding: '0.5rem 1rem', borderRadius: 6, border: 'none', background: 'var(--secure)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            Save Consultation
          </button>
        </form>
      </section>
    </main>
  );
}
