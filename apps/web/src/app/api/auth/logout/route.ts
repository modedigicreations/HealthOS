import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  getApiBaseUrl,
  getSessionUser,
} from '../../../../lib/session';

export async function POST() {
  const session = await getSessionUser();
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE_NAME)?.value;

  if (session) {
    await fetch(`${getApiBaseUrl()}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }

  const res = NextResponse.json({ loggedOut: true });
  res.cookies.delete(ACCESS_COOKIE_NAME);
  res.cookies.delete(REFRESH_COOKIE_NAME);
  res.headers.set('Clear-Site-Data', '"cookies", "storage", "cache"');
  return res;
}
