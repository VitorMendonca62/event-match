import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { LegalMarkdown } from '@/features/registration/components/legal-markdown';
import { type FlowNotice, RegistrationFlow } from '@/features/registration/components/registration-flow';
import type { Catalog, LegalDocumentSource, LegalDocumentView } from '@/features/registration/view-models';
import { getBffEnv } from '@/shared/config/bff-env.server';
import { LINK_RESULT_PARAM } from '@/shared/server/confirm-link';
import { continuationCookieName, isContinuationToken } from '@/shared/server/continuation-cookie';
import { loadRegistrationView } from '@/shared/server/registration-view';

export const metadata: Metadata = {
  title: 'Cadastro · EventMatch',
  referrer: 'no-referrer',
};

type RegistrationPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

/** Renders each text to elements here so the raw Markdown never reaches the client island. */
function toDocumentViews(documents: Catalog<LegalDocumentSource>): Catalog<LegalDocumentView> {
  if (documents.status !== 'ready') return documents;
  return {
    status: 'ready',
    items: documents.items.map(({ id, kind, version, effectiveAt, content }) => ({
      id,
      kind,
      version,
      effectiveAt,
      body: <LegalMarkdown source={content} />,
    })),
  };
}

export default async function RegistrationPage({ searchParams }: RegistrationPageProps) {
  // Request data first: it makes the route dynamic before any server-only configuration is read.
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  const env = getBffEnv();
  const token = cookieStore.get(continuationCookieName(env))?.value;
  const view = await loadRegistrationView(isContinuationToken(token) ? token : undefined, { env });

  if (view.stage === 'completed') redirect('/cadastro/concluido');

  const linkResult = params[LINK_RESULT_PARAM];
  const notice: FlowNotice = view.sessionExpired
    ? 'expired'
    : linkResult === '1' && view.stage === 'contact_verified'
      ? 'email-verified'
      : linkResult === '0'
        ? 'link-failed'
        : null;

  return (
    <RegistrationFlow
      stage={view.stage}
      expiresAt={view.expiresAt}
      nextResendAt={view.nextResendAt}
      notice={notice}
      documents={toDocumentViews(view.documents)}
      interests={view.interests}
    />
  );
}
