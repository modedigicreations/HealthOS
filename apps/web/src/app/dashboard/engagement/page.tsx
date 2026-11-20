'use client';

import { useState, type FormEvent } from 'react';

export default function EngagementPage() {
  const [branchId, setBranchId] = useState('');
  const [patientId, setPatientId] = useState('');
  const [channel, setChannel] = useState('WHATSAPP');
  const [notificationType, setNotificationType] = useState('APPOINTMENT_REMINDER');
  const [message, setMessage] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function sendNotification(e: FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    const res = await fetch('/api/proxy/v1/engagement/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId, patientId, channel, notificationType, message }),
    });
    const data = await res.json();
    setStatusMsg(res.ok ? `Notification queued (${data.notificationId})` : data.message ?? 'Error');
  }

  return (
    <main style={{ display: 'grid', gap: '1.5rem' }}>
      <header>
        <h1 style={{ margin: '0 0 0.25rem' }}>Module 10: Patient Engagement & Communication</h1>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          Encrypted SMS, Email, WhatsApp Business notifications, secure messaging, and satisfaction surveys.
        </p>
      </header>

      {statusMsg && (
        <div role="status" style={{ padding: '0.75rem', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {statusMsg}
        </div>
      )}

      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Send Patient Notification</h2>
        <form onSubmit={sendNotification} style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input required placeholder="Branch UUID" value={branchId} onChange={(e) => setBranchId(e.target.value)} style={{ flex: 1, minWidth: 200, padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
            <input required placeholder="Patient UUID" value={patientId} onChange={(e) => setPatientId(e.target.value)} style={{ flex: 1, minWidth: 200, padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
            <select aria-label="Channel" value={channel} onChange={(e) => setChannel(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }}>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="SMS">SMS</option>
              <option value="EMAIL">Email</option>
              <option value="PORTAL">Patient Portal</option>
            </select>
            <select aria-label="Notification Type" value={notificationType} onChange={(e) => setNotificationType(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }}>
              <option value="APPOINTMENT_REMINDER">Appointment Reminder</option>
              <option value="LAB_RESULT_READY">Lab Result Ready</option>
              <option value="PRESCRIPTION_REFILL">Prescription Refill</option>
              <option value="FOLLOW_UP">Follow-Up</option>
            </select>
          </div>
          <textarea required rows={3} placeholder="Encrypted message body..." value={message} onChange={(e) => setMessage(e.target.value)} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
          <button type="submit" style={{ width: 'fit-content', padding: '0.5rem 1rem', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            Queue Notification
          </button>
        </form>
      </section>
    </main>
  );
}
