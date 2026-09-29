import type { ReactNode } from 'react';

import type { LegalDocumentKind } from './contracts';

/**
 * Minimal props serialized from the RSC to the client flow (`server-serialization`): only public
 * catalog fields, never contact, birth date, tokens or internal ids beyond the catalog ids the
 * contract requires for submission.
 */
export type InterestOption = Readonly<{ id: string; label: string }>;

type LegalDocumentMeta = Readonly<{
  id: string;
  kind: LegalDocumentKind;
  version: string;
  effectiveAt: string;
}>;

/** Server-only shape: carries the raw Markdown and never crosses into the client island (ADR-029). */
export type LegalDocumentSource = LegalDocumentMeta & Readonly<{ content: string }>;

export type LegalDocumentView = LegalDocumentMeta &
  Readonly<{
    /** Text rendered on the server; absent means the step stays blocked. */
    body?: ReactNode;
    /** Marks non-legal fixtures used by visual tests; acceptance has no effect. */
    fixture?: boolean;
  }>;

export type Catalog<T> =
  | Readonly<{ status: 'ready'; items: readonly T[] }>
  | Readonly<{ status: 'unavailable' }>
  | Readonly<{ status: 'deferred' }>;

export const LEGAL_DOCUMENT_TITLES: Record<LegalDocumentKind, string> = {
  terms: 'Termos de Uso',
  privacy: 'Política de Privacidade',
  community_rules: 'Regras de Convivência',
};
