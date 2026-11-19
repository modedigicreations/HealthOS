import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'HealthOS — All-in-One Healthcare Management System',
  description:
    'Zero-trust, encrypted clinical, laboratory, pharmacy, billing, and multi-branch healthcare platform by MODE Digital Creations Limited.',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const hdrs = await headers();
  const nonce = hdrs.get('x-nonce') ?? undefined;

  return (
    <html lang="en">
      <body data-csp-nonce={nonce ? 'active' : 'none'}>{children}</body>
    </html>
  );
}
