/** Documents every account must accept before activation (RF005, ADR-012). */
export const REQUIRED_TERMS_KINDS = ['terms', 'privacy', 'community_rules'] as const;

export type TermsDocumentKind = (typeof REQUIRED_TERMS_KINDS)[number];

/** True when the approved documents cover every required kind; extra versions are harmless. */
export function coversRequiredTerms(acceptedKinds: Iterable<TermsDocumentKind>): boolean {
  const accepted = new Set(acceptedKinds);
  return REQUIRED_TERMS_KINDS.every((kind) => accepted.has(kind));
}
