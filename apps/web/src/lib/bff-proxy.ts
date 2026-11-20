import { NextResponse } from 'next/server';
import { getApiBaseUrl, getSessionUser } from './session';

const ALLOWED_PREFIXES = [
  'v1/clinical',
  'v1/lab',
  'v1/pharmacy',
  'v1/procurement',
  'v1/billing',
  'v1/hr',
  'v1/compliance',
  'v1/equipment',
  'v1/engagement',
  'v1/analytics',
  'v1/organization',
  'v1/advanced',
];

export async function proxyToApi(req: Request, pathSegments: string[]) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const joined = pathSegments.join('/');
  if (!ALLOWED_PREFIXES.some((prefix) => joined === prefix || joined.startsWith(`${prefix}/`))) {
    return NextResponse.json({ message: 'Forbidden proxy path' }, { status: 403 });
  }

  const url = new URL(req.url);
  const targetUrl = `${getApiBaseUrl()}/api/${joined}${url.search}`;

  const hasBody = !['GET', 'HEAD'].includes(req.method);
  const bodyText = hasBody ? await req.text() : undefined;

  const apiRes = await fetch(targetUrl, {
    method: req.method,
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(bodyText ? { body: bodyText } : {}),
    cache: 'no-store',
  });

  const text = await apiRes.text();
  try {
    return NextResponse.json(JSON.parse(text), { status: apiRes.status });
  } catch {
    return new NextResponse(text, { status: apiRes.status });
  }
}
