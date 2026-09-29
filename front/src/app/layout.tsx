import type { Metadata, Viewport } from 'next';
import { Archivo, Figtree } from 'next/font/google';
import type { ReactNode } from 'react';

import { QueryProvider } from '@/components/client/query-provider';

import './globals.css';

// Self-hosted at build time by next/font (`server-hoist-static-io`): no runtime request to Google.
const poster = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-poster',
  display: 'swap',
});

const body = Figtree({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'EventMatch',
  description: 'Amizade, companhia e atividades locais para pessoas adultas. Não é app de namoro.',
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  colorScheme: 'dark',
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR" className={`${poster.variable} ${body.variable}`}>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
