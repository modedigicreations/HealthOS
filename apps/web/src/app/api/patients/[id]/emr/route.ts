import { NextResponse } from 'next/server';
import { getApiBaseUrl, getSessionUser } from '../../../../../lib/session';

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const apiRes = await fetch(`${getApiBaseUrl()}/api/v1/patients/${id}/emr`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store',
  });
  const data = await apiRes.json();
  return NextResponse.json(data, { status: apiRes.status });
}
