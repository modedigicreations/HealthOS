import { NextResponse } from 'next/server';
import { getApiBaseUrl, getSessionUser } from '../../../lib/session';

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const apiRes = await fetch(
    `${getApiBaseUrl()}/api/v1/patients/search?${url.searchParams.toString()}`,
    {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: 'no-store',
    },
  );
  const data = await apiRes.json();
  return NextResponse.json(data, { status: apiRes.status });
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const apiRes = await fetch(`${getApiBaseUrl()}/api/v1/patients`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify({
      ...body,
      branchId: body.branchId ?? session.user.branchId,
    }),
  });
  const data = await apiRes.json();
  return NextResponse.json(data, { status: apiRes.status });
}
