import { ProfileError } from '../errors/profile.error';

export const SOCIAL_PROVIDERS = ['instagram', 'linkedin', 'x'] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];
export type SocialLinkVisibility = 'private' | 'authenticated' | 'public';
export type EditableSocialLinkVisibility = Exclude<SocialLinkVisibility, 'public'>;

export type SocialLink = Readonly<{
  id: string;
  provider: SocialProvider;
  canonicalIdentifier: string;
  position: number;
  visibility: SocialLinkVisibility;
}>;

export type SocialLinkDraft = Readonly<{
  id?: string;
  provider: string;
  identifierOrUrl: string;
  position: number;
  visibility: string;
}>;

type ProviderDefinition = Readonly<{
  hosts: readonly string[];
  pathPrefix: string | null;
  identifierPattern: RegExp;
  maxLength: number;
  baseUrl: string;
}>;

const PROVIDER_REGISTRY: Readonly<Record<SocialProvider, ProviderDefinition>> = {
  instagram: {
    hosts: ['instagram.com', 'www.instagram.com'],
    pathPrefix: null,
    identifierPattern: /^[a-z0-9._]{1,30}$/u,
    maxLength: 30,
    baseUrl: 'https://www.instagram.com/',
  },
  linkedin: {
    hosts: ['linkedin.com', 'www.linkedin.com'],
    pathPrefix: 'in',
    identifierPattern: /^[a-z0-9-]{3,100}$/u,
    maxLength: 100,
    baseUrl: 'https://www.linkedin.com/in/',
  },
  x: {
    hosts: ['x.com', 'www.x.com'],
    pathPrefix: null,
    identifierPattern: /^[a-z0-9_]{1,15}$/u,
    maxLength: 15,
    baseUrl: 'https://x.com/',
  },
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/iu;
const EXPLICIT_PORT_PATTERN = /^https:\/\/[^/]+:\d+(?:\/|$)/iu;

function invalid(): never {
  throw new ProfileError('INVALID_PROFILE_CONTENT');
}

function providerDefinition(provider: string): ProviderDefinition & { provider: SocialProvider } {
  if (!SOCIAL_PROVIDERS.includes(provider as SocialProvider)) invalid();
  return { provider: provider as SocialProvider, ...PROVIDER_REGISTRY[provider as SocialProvider] };
}

function canonicalizeIdentifier(provider: SocialProvider, rawIdentifier: string): string {
  const definition = PROVIDER_REGISTRY[provider];
  let identifier = rawIdentifier.trim();
  if ((provider === 'instagram' || provider === 'x') && identifier.startsWith('@')) identifier = identifier.slice(1);
  if (!identifier || identifier.length > definition.maxLength || !definition.identifierPattern.test(identifier.toLowerCase())) invalid();
  return identifier.toLowerCase();
}

function parseProfileUrl(provider: SocialProvider, value: string): string {
  if (!/^https:\/\//iu.test(value) || EXPLICIT_PORT_PATTERN.test(value) || value.includes('@')) invalid();
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    invalid();
  }
  const definition = PROVIDER_REGISTRY[provider];
  if (
    parsed.protocol !== 'https:' ||
    !definition.hosts.includes(parsed.hostname.toLowerCase()) ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname.includes('//')
  ) invalid();

  const pathname = parsed.pathname.replace(/\/$/u, '');
  const segments = pathname.split('/').filter(Boolean);
  const expectedSegments = definition.pathPrefix ? [definition.pathPrefix] : [];
  if (segments.length !== expectedSegments.length + 1 || expectedSegments.some((segment, index) => segments[index]?.toLowerCase() !== segment)) invalid();
  let identifier: string;
  try {
    identifier = decodeURIComponent(segments.at(-1) ?? '');
  } catch {
    invalid();
  }
  return canonicalizeIdentifier(provider, identifier);
}

export function parseSocialLink(input: Readonly<{ provider: string; identifierOrUrl: string }>): Readonly<{ provider: SocialProvider; canonicalIdentifier: string }> {
  const definition = providerDefinition(input.provider);
  if (typeof input.identifierOrUrl !== 'string' || !input.identifierOrUrl.trim()) invalid();
  const value = input.identifierOrUrl.trim();
  const canonicalIdentifier = URL_SCHEME_PATTERN.test(value) || value.startsWith('//')
    ? parseProfileUrl(definition.provider, value)
    : canonicalizeIdentifier(definition.provider, value);
  return { provider: definition.provider, canonicalIdentifier };
}

export function normalizeSocialLinkDrafts(drafts: readonly SocialLinkDraft[], idFactory: () => string): readonly SocialLink[] {
  if (drafts.length > 3) invalid();
  const links = drafts.map((draft) => {
    if (!Number.isInteger(draft.position) || draft.position < 1 || draft.position > 3) invalid();
    if (!['private', 'authenticated'].includes(draft.visibility)) invalid();
    const parsed = parseSocialLink(draft);
    const id = draft.id ?? idFactory();
    if (!UUID_PATTERN.test(id)) invalid();
    return {
      id,
      provider: parsed.provider,
      canonicalIdentifier: parsed.canonicalIdentifier,
      position: draft.position,
      visibility: draft.visibility as EditableSocialLinkVisibility,
    } satisfies SocialLink;
  });
  if (new Set(links.map((link) => link.id)).size !== links.length) invalid();
  if (new Set(links.map((link) => link.provider)).size !== links.length) invalid();
  if (new Set(links.map((link) => link.position)).size !== links.length) invalid();
  return [...links].sort((left, right) => left.position - right.position);
}

export function validateSocialLinks(links: readonly SocialLink[]): boolean {
  if (links.length > 3) return false;
  if (new Set(links.map((link) => link.id)).size !== links.length) return false;
  if (new Set(links.map((link) => link.provider)).size !== links.length) return false;
  if (new Set(links.map((link) => link.position)).size !== links.length) return false;
  return links.every((link) => {
    if (!UUID_PATTERN.test(link.id) || !Number.isInteger(link.position) || link.position < 1 || link.position > 3) return false;
    if (!SOCIAL_PROVIDERS.includes(link.provider) || !['private', 'authenticated', 'public'].includes(link.visibility)) return false;
    try {
      return parseSocialLink({ provider: link.provider, identifierOrUrl: link.canonicalIdentifier }).canonicalIdentifier === link.canonicalIdentifier;
    } catch {
      return false;
    }
  });
}

export function toSocialProfileUrl(link: Readonly<Pick<SocialLink, 'provider' | 'canonicalIdentifier'>>): string {
  return `${PROVIDER_REGISTRY[link.provider].baseUrl}${link.canonicalIdentifier}`;
}
