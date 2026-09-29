import type { LegalDocumentKind } from './contracts';

/**
 * Minimal props serialized from the RSC to the client flow (`server-serialization`): only public
 * catalog fields, never contact, birth date, tokens or internal ids beyond the catalog ids the
 * contract requires for submission.
 */
export type InterestOption = Readonly<{ id: string; label: string }>;

export type LegalDocumentView = Readonly<{
  id: string;
  kind: LegalDocumentKind;
  version: string;
  effectiveAt: string;
  /** Approved text; the v1 contract publishes metadata only, so it is absent until it does. */
  content?: string;
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
  community_rules: 'Regras da Comunidade',
};
