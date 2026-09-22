import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { QueryProvider } from '@/components/client/query-provider';

import './globals.css';

export const metadata: Metadata = {
  title: 'EventMatch',
  description: 'Conheça pessoas e descubra atividades locais.',
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
