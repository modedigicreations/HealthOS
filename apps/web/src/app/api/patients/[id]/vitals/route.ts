import { NextResponse } from 'next/server';
import { getApiBaseUrl, getSessionUser } from '../../../../../lib/session';

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const body = await req.json();
  const apiRes = await fetch(`${getApiBaseUrl()}/api/v1/patients/${id}/vitals`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = await apiRes.json();
  return NextResponse.json(data, { status: apiRes.status });
}
