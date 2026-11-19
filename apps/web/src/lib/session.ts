import { cookies } from 'next/headers';
import type { UserRole } from '@healthos/contracts';

export const ACCESS_COOKIE_NAME =
  process.env.NODE_ENV === 'production' ? '__Host-healthos_access' : 'healthos_access';
export const REFRESH_COOKIE_NAME =
  process.env.NODE_ENV === 'production' ? '__Host-healthos_refresh' : 'healthos_refresh';

export function getApiBaseUrl(): string {
  return process.env.HEALTHOS_API_URL ?? 'http://localhost:4000';
}

export interface SessionUser {
  sub: string;
  orgId: string;
  branchId: string | null;
  role: UserRole;
  mfaVerified: boolean;
}

/**
 * Decodes JWT payload for UI role-gating only; cryptographic verification
 * is always enforced by the NestJS API on every request.
 */
export async function getSessionUser(): Promise<{ user: SessionUser; accessToken: string } | null> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const [, payloadB64] = token.split('.');
    if (!payloadB64) return null;
    const json = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as SessionUser & {
      exp?: number;
    };
    if (json.exp && json.exp * 1000 < Date.now()) return null;
    return { user: json, accessToken: token };
  } catch {
    return null;
  }
}

export function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}
