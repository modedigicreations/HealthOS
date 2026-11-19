'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';

interface SearchResult {
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
}

export function PatientWorkspaceClient({ canCreate }: { canCreate: boolean }) {
  const [searchField, setSearchField] = useState<'patientNumber' | 'phone' | 'email' | 'nationalId'>('phone');
  const [searchValue, setSearchValue] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('FEMALE');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [genotype, setGenotype] = useState('AA');
  const [registerMsg, setRegisterMsg] = useState<string | null>(null);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setSearchError(null);
    const params = new URLSearchParams({ [searchField]: searchValue });
    const res = await fetch(`/api/patients?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) {
      setSearchError(data.message ?? 'Search failed');
      return;
    }
    setResults(data);
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setRegisterMsg(null);
    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName,
        lastName,
        dateOfBirth,
        gender,
        phone,
        email: email || undefined,
        bloodGroup,
        genotype,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setRegisterMsg(data.message ?? 'Registration failed');
      return;
    }
    setRegisterMsg(`Registered patient ${data.patientNumber} (ID: ${data.patientId})`);
    setFirstName('');
    setLastName('');
    setPhone('');
    setEmail('');
  }

  return (
    <div style={{ display: 'grid', gap: '2rem' }}>
      <section
        aria-labelledby="search-heading"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '1.25rem',
        }}
      >
        <h2 id="search-heading" style={{ margin: '0 0 1rem', fontSize: '1.125rem' }}>
          Blind-Indexed Patient Search
        </h2>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <select
            aria-label="Search field"
            value={searchField}
            onChange={(e) => setSearchField(e.target.value as typeof searchField)}
            style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }}
          >
            <option value="phone">Phone</option>
            <option value="patientNumber">Patient Number</option>
            <option value="email">Email</option>
            <option value="nationalId">National ID</option>
          </select>
          <input
            type="text"
            required
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Exact match value..."
            style={{ flex: 1, minWidth: 220, padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }}
          />
          <button
            type="submit"
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 6,
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Search
          </button>
        </form>

        {searchError && <p style={{ color: '#ef4444', fontSize: '0.875rem' }}>{searchError}</p>}

        {results.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '0.5rem' }}>Patient #</th>
                <th style={{ padding: '0.5rem' }}>Name</th>
                <th style={{ padding: '0.5rem' }}>DOB</th>
                <th style={{ padding: '0.5rem' }}>Blood / Genotype</th>
                <th style={{ padding: '0.5rem' }}>EMR</th>
              </tr>
            </thead>
            <tbody>
              {results.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.5rem', fontWeight: 600 }}>{p.patientNumber}</td>
                  <td style={{ padding: '0.5rem' }}>
                    {p.demographics.firstName} {p.demographics.lastName}
                  </td>
                  <td style={{ padding: '0.5rem' }}>{p.demographics.dateOfBirth}</td>
                  <td style={{ padding: '0.5rem' }}>
                    {p.bloodGroup} / {p.genotype}
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <Link href={`/dashboard/patients/${p.id}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                      Open EMR
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {canCreate && (
        <section
          aria-labelledby="register-heading"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '1.25rem',
          }}
        >
          <h2 id="register-heading" style={{ margin: '0 0 1rem', fontSize: '1.125rem' }}>
            Register New Patient (AES-256-GCM Encrypted)
          </h2>
          {registerMsg && (
            <p role="status" style={{ color: 'var(--secure)', fontWeight: 600, fontSize: '0.9rem' }}>
              {registerMsg}
            </p>
          )}
          <form
            onSubmit={handleRegister}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}
          >
            <input
              required
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }}
            />
            <input
              required
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }}
            />
            <input
              required
              type="date"
              aria-label="Date of Birth"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }}
            />
            <select
              aria-label="Gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }}
            >
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
              <option value="OTHER">Other</option>
            </select>
            <input
              required
              placeholder="Phone (+234...)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }}
            />
            <input
              type="email"
              placeholder="Email (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }}
            />
            <select
              aria-label="Blood Group"
              value={bloodGroup}
              onChange={(e) => setBloodGroup(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }}
            >
              {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'UNKNOWN'].map((bg) => (
                <option key={bg} value={bg}>
                  Blood: {bg}
                </option>
              ))}
            </select>
            <select
              aria-label="Genotype"
              value={genotype}
              onChange={(e) => setGenotype(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }}
            >
              {['AA', 'AS', 'SS', 'AC', 'SC', 'UNKNOWN'].map((gt) => (
                <option key={gt} value={gt}>
                  Genotype: {gt}
                </option>
              ))}
            </select>
            <button
              type="submit"
              style={{
                padding: '0.625rem 1rem',
                borderRadius: 6,
                border: 'none',
                background: 'var(--secure)',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Register Patient
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
