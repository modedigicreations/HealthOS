'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [organizationSlug, setOrganizationSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationSlug, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Authentication failed');
        return;
      }
      if (data.mfaRequired) {
        setMfaChallengeToken(data.mfaChallengeToken);
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Unable to reach authentication server.');
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaVerify(e: FormEvent) {
    e.preventDefault();
    if (!mfaChallengeToken) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/mfa-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaChallengeToken, code: mfaCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Invalid MFA code');
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Unable to verify MFA code.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '1.5rem',
      }}
    >
      <section
        aria-labelledby="login-heading"
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '2rem',
        }}
      >
        <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: 'var(--secure)' }}>
          ZERO-TRUST CLINICAL ACCESS
        </p>
        <h1 id="login-heading" style={{ margin: '0.25rem 0 1.25rem', fontSize: '1.5rem' }}>
          {mfaChallengeToken ? 'Two-Factor Verification' : 'Sign in to HealthOS'}
        </h1>

        {error && (
          <div
            role="alert"
            style={{
              marginBottom: '1rem',
              padding: '0.75rem',
              borderRadius: 8,
              background: 'rgba(220, 38, 38, 0.12)',
              color: '#ef4444',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}

        {!mfaChallengeToken ? (
          <form onSubmit={handleLogin} style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <label htmlFor="org-slug" style={{ display: 'block', fontSize: '0.875rem', marginBottom: 4 }}>
                Facility / Organization Slug
              </label>
              <input
                id="org-slug"
                name="organizationSlug"
                type="text"
                required
                value={organizationSlug}
                onChange={(e) => setOrganizationSlug(e.target.value)}
                placeholder="mode-general"
                style={{ width: '100%', padding: '0.625rem', borderRadius: 6, border: '1px solid var(--border)' }}
              />
            </div>

            <div>
              <label htmlFor="email" style={{ display: 'block', fontSize: '0.875rem', marginBottom: 4 }}>
                Work Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@hospital.org"
                style={{ width: '100%', padding: '0.625rem', borderRadius: 6, border: '1px solid var(--border)' }}
              />
            </div>

            <div>
              <label htmlFor="password" style={{ display: 'block', fontSize: '0.875rem', marginBottom: 4 }}>
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', padding: '0.625rem', borderRadius: 6, border: '1px solid var(--border)' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.75rem',
                borderRadius: 8,
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleMfaVerify} style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <label htmlFor="mfa-code" style={{ display: 'block', fontSize: '0.875rem', marginBottom: 4 }}>
                6-Digit Authenticator Code
              </label>
              <input
                id="mfa-code"
                name="code"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="123456"
                style={{ width: '100%', padding: '0.625rem', borderRadius: 6, border: '1px solid var(--border)' }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.75rem',
                borderRadius: 8,
                border: 'none',
                background: 'var(--secure)',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {loading ? 'Verifying...' : 'Verify MFA'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
