'use client';

import { useState, type FormEvent } from 'react';

export default function AdvancedPage() {
  const [question, setQuestion] = useState('Which department generated the most revenue this month?');
  const [assistantAnswer, setAssistantAnswer] = useState<string | null>(null);
  const [fhirPatientId, setFhirPatientId] = useState('');
  const [fhirOutput, setFhirOutput] = useState<string | null>(null);

  async function askAssistant(e: FormEvent) {
    e.preventDefault();
    setAssistantAnswer(null);
    const res = await fetch('/api/proxy/v1/advanced/assistant/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    const data = await res.json();
    setAssistantAnswer(res.ok ? data.answer : data.message ?? 'Error');
  }

  async function fetchFhir(e: FormEvent) {
    e.preventDefault();
    setFhirOutput(null);
    const res = await fetch(`/api/proxy/v1/advanced/fhir/Patient/${fhirPatientId}`);
    const data = await res.json();
    setFhirOutput(JSON.stringify(data, null, 2));
  }

  return (
    <main style={{ display: 'grid', gap: '1.5rem' }}>
      <header>
        <h1 style={{ margin: '0 0 0.25rem' }}>Section 3: AI Operations, FHIR & Predictive BI</h1>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          AI Healthcare Operations Assistant, Self-Service Kiosk, Telemedicine, HL7 FHIR R4, and Predictive BI.
        </p>
      </header>

      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>AI Healthcare Operations Assistant</h2>
        <form onSubmit={askAssistant} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            required
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            style={{ flex: 1, minWidth: 260, padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }}
          />
          <button type="submit" style={{ padding: '0.5rem 1rem', borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            Ask Assistant
          </button>
        </form>
        {assistantAnswer && (
          <p role="status" style={{ marginTop: '0.75rem', fontWeight: 600, color: 'var(--secure)' }}>
            {assistantAnswer}
          </p>
        )}
      </section>

      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.25rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>HL7 FHIR R4 Patient Export</h2>
        <form onSubmit={fetchFhir} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            required
            placeholder="Patient UUID"
            value={fhirPatientId}
            onChange={(e) => setFhirPatientId(e.target.value)}
            style={{ flex: 1, minWidth: 240, padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }}
          />
          <button type="submit" style={{ padding: '0.5rem 1rem', borderRadius: 6, border: 'none', background: 'var(--secure)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            Export FHIR Patient
          </button>
        </form>
        {fhirOutput && (
          <pre style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: 6, background: 'var(--bg)', overflowX: 'auto', fontSize: '0.8rem' }}>
            {fhirOutput}
          </pre>
        )}
      </section>
    </main>
  );
}
