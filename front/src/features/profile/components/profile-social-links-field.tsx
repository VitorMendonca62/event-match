/** @format */

'use client';

import { useId, useState } from 'react';
import type { OwnProfile, SocialProvider } from '../contracts';
import { SOCIAL_PROVIDER_HELP, SOCIAL_PROVIDER_LABELS, SOCIAL_PROVIDER_PLACEHOLDERS } from '../messages';
import { SOCIAL_PROVIDER_OPTIONS } from '../social-links';

type SocialLinkDraft = Readonly<{
  id?: string;
  provider: SocialProvider;
  identifierOrUrl: string;
  position: number;
  visibility: 'private' | 'authenticated';
  url?: string;
}>;

function initialDrafts(profile: OwnProfile): SocialLinkDraft[] {
  return SOCIAL_PROVIDER_OPTIONS.map(({ value: provider }, index) => {
    const existingLink = profile.socialLinks.find((link) => link.provider === provider);

    return {
      id: existingLink?.id,
      provider,
      identifierOrUrl: existingLink?.identifier ?? '',
      position: index + 1,
      visibility: existingLink?.visibility === 'authenticated' ? 'authenticated' : 'private',
      url: existingLink?.url,
    };
  });
}

function SocialProviderMark({ provider }: Readonly<{ provider: SocialProvider }>) {
  if (provider === 'instagram') {
    return (
      <svg aria-hidden="true" className="size-6 shrink-0" viewBox="0 0 24 24" fill="none">
        <rect x="3.25" y="3.25" width="17.5" height="17.5" rx="5" stroke="currentColor" strokeWidth="1.9" />
        <circle cx="12" cy="12" r="4.1" stroke="currentColor" strokeWidth="1.9" />
        <circle cx="17.35" cy="6.7" r="1" fill="currentColor" />
      </svg>
    );
  }

  if (provider === 'linkedin') {
    return (
      <svg aria-hidden="true" className="size-6 shrink-0" viewBox="0 0 24 24" fill="none">
        <rect x="3.25" y="3.25" width="17.5" height="17.5" rx="3" stroke="currentColor" strokeWidth="1.9" />
        <path d="M8 10.25v6M8 7.75v.01M11.5 16.25v-6M11.5 13.1c0-2.8 4.5-2.8 4.5 0v3.15" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="size-6 shrink-0" viewBox="0 0 24 24" fill="none">
      <path d="m5 5 14 14M19 5 5 19" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function ProfileSocialLinksField({
  initial,
  error,
  onDirty,
}: Readonly<{
  initial: OwnProfile;
  error?: string;
  onDirty: () => void;
}>) {
  const [links, setLinks] = useState(() => initialDrafts(initial));
  const [shareSocialLinks, setShareSocialLinks] = useState(() => initial.socialLinks.length > 0 && initial.socialLinks.every(({ visibility }) => visibility === 'authenticated'));
  const [sharingChanged, setSharingChanged] = useState(false);
  const descriptionId = useId();
  const sharingId = `${descriptionId}-sharing`;
  const errorId = `${descriptionId}-error`;
  const serialized = JSON.stringify(links
    .filter(({ identifierOrUrl }) => identifierOrUrl.trim().length > 0)
    .map(({ id, provider, identifierOrUrl, position, visibility }) => ({
      ...(id ? { id } : {}),
      provider,
      identifierOrUrl,
      position,
      visibility: sharingChanged ? (shareSocialLinks ? 'authenticated' : 'private') : visibility,
    })));

  function updateIdentifier(index: number, identifierOrUrl: string) {
    setLinks((current) => current.map((link, linkIndex) => linkIndex === index ? { ...link, identifierOrUrl, url: undefined } : link));
    onDirty();
  }

  function updateSharing(checked: boolean) {
    setShareSocialLinks(checked);
    setSharingChanged(true);
    onDirty();
  }

  return (
    <section aria-labelledby="profile-social-links" className="space-y-6 border-b border-border pb-10">
      <div>
        <h2 id="profile-social-links" className="text-xl font-bold">Presença social (opcional)</h2>
        <p id={descriptionId} className="mt-1 max-w-[65ch] text-muted-foreground">
          Compartilhe um perfil externo somente se isso ajudar alguém a reconhecer seus interesses. O EventMatch não verifica esses perfis, não busca conteúdo e eles começam privados.
        </p>
      </div>
      <input type="hidden" name="socialLinks" value={serialized} />
      <div className="space-y-4" aria-describedby={error ? `${descriptionId} ${errorId}` : descriptionId}>
        {links.map((link, index) => {
          const fieldId = `${descriptionId}-${link.provider}`;
          const helpId = `${fieldId}-help`;
          const providerLabel = SOCIAL_PROVIDER_LABELS[link.provider];
          const providerHelp = SOCIAL_PROVIDER_HELP[link.provider];

          return (
            <div key={link.provider} className="space-y-3 rounded-2xl border-2 border-border bg-surface p-4 sm:p-5">
              <label htmlFor={fieldId} className="block space-y-3">
                <span className="flex items-center gap-3 text-lg font-bold">
                  <SocialProviderMark provider={link.provider} />
                  <span>{providerLabel}</span>
                </span>
                {providerHelp ? <span id={helpId} className="block text-sm text-muted-foreground">{providerHelp}</span> : null}
                <span className="sr-only">Identificador ou link do perfil</span>
                <input
                  id={fieldId}
                  value={link.identifierOrUrl}
                  onChange={(event) => updateIdentifier(index, event.target.value)}
                  maxLength={200}
                  className="min-h-13 w-full rounded-xl border-2 border-border bg-surface px-4 text-lg text-foreground hover:border-muted-foreground"
                  placeholder={SOCIAL_PROVIDER_PLACEHOLDERS[link.provider]}
                  aria-label={`${providerLabel} — identificador ou link do perfil`}
                  aria-describedby={providerHelp ? helpId : undefined}
                  aria-invalid={error ? true : undefined}
                />
              </label>
              {link.url ? <p className="text-sm text-muted-foreground">Endereço derivado: <span className="break-all font-mono text-foreground">{link.url}</span></p> : null}
            </div>
          );
        })}
      </div>
      <label htmlFor={sharingId} className="flex min-h-16 cursor-pointer items-center justify-between gap-4 rounded-2xl border-2 border-border bg-surface p-4 transition-colors has-[:checked]:border-foreground has-[:checked]:bg-primary-muted has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-warning sm:p-5">
        <span className="min-w-0">
          <span className="block font-semibold">Compartilhar redes sociais futuramente?</span>
          <span className="mt-1 block text-sm text-muted-foreground">Ative para mostrar a pessoas autenticadas quando esse recurso estiver disponível.</span>
        </span>
        <span className="relative shrink-0">
          <input
            id={sharingId}
            type="checkbox"
            role="switch"
            name="socialLinksVisibility"
            value="authenticated"
            checked={shareSocialLinks}
            onChange={(event) => updateSharing(event.target.checked)}
            className="peer sr-only"
          />
          <span aria-hidden="true" className="block h-7 w-12 rounded-full bg-border transition-colors peer-checked:bg-primary peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary" />
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 block size-7 rounded-full border-2 border-background bg-foreground shadow-sm transition-transform peer-checked:translate-x-5" />
        </span>
      </label>
      {error ? <p id={errorId} className="font-semibold text-error" role="alert">{error}</p> : null}
    </section>
  );
}
