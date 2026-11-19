import { NextResponse } from 'next/server';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  cookieOptions,
  getApiBaseUrl,
} from '../../../../lib/session';

export async function POST(req: Request) {
  const body = await req.json();
  const apiRes = await fetch(`${getApiBaseUrl()}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await apiRes.json();
  if (!apiRes.ok) {
    return NextResponse.json(data, { status: apiRes.status });
  }

  if (data.mfaRequired) {
    return NextResponse.json({
      mfaRequired: true,
      mfaChallengeToken: data.mfaChallengeToken,
    });
  }

  const res = NextResponse.json({ mfaRequired: false, authenticated: true });
  res.cookies.set(ACCESS_COOKIE_NAME, data.accessToken, cookieOptions(data.expiresInSeconds ?? 900));
  res.cookies.set(REFRESH_COOKIE_NAME, data.refreshToken, cookieOptions(604800));
  return res;
}
