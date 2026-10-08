/** @format */

'use client';

import { useId, useState } from 'react';
import type { OwnProfile, SocialProvider } from '../contracts';
import { SOCIAL_PROVIDER_HELP, SOCIAL_PROVIDER_LABELS, SOCIAL_PROVIDER_PLACEHOLDERS } from '../messages';
import { SOCIAL_PROVIDER_OPTIONS } from '../social-links';
import { VisibilityIcon } from './profile-visibility-icon';

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
      <svg aria-hidden="true" className="size-5 shrink-0" viewBox="0 0 24 24" fill="none">
        <rect x="3.25" y="3.25" width="17.5" height="17.5" rx="5" stroke="currentColor" strokeWidth="1.9" />
        <circle cx="12" cy="12" r="4.1" stroke="currentColor" strokeWidth="1.9" />
        <circle cx="17.35" cy="6.7" r="1" fill="currentColor" />
      </svg>
    );
  }

  if (provider === 'linkedin') {
    return (
      <svg aria-hidden="true" className="size-5 shrink-0" viewBox="0 0 24 24" fill="none">
        <rect x="3.25" y="3.25" width="17.5" height="17.5" rx="3" stroke="currentColor" strokeWidth="1.9" />
        <path d="M8 10.25v6M8 7.75v.01M11.5 16.25v-6M11.5 13.1c0-2.8 4.5-2.8 4.5 0v3.15" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="size-5 shrink-0" viewBox="0 0 24 24" fill="none">
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
    <section aria-labelledby="profile-social-links" className="space-y-5">
      <div>
        <h3 id="profile-social-links" className="text-lg font-bold">Presença social (opcional)</h3>
        <p id={descriptionId} className="mt-1 max-w-[65ch] text-sm text-muted-foreground">
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
            <div key={link.provider} className="space-y-1.5">
              <label htmlFor={fieldId} className="block text-sm font-semibold"><span>{providerLabel}</span><span className="sr-only">Identificador ou link do perfil</span></label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-muted-foreground">
                  <SocialProviderMark provider={link.provider} />
                </span>
                <input
                  id={fieldId}
                  value={link.identifierOrUrl}
                  onChange={(event) => updateIdentifier(index, event.target.value)}
                  maxLength={200}
                  className="min-h-13 w-full rounded-xl border-2 border-border bg-surface ps-12 pe-4 text-foreground placeholder:text-disabled hover:border-muted-foreground focus-visible:border-foreground"
                  placeholder={SOCIAL_PROVIDER_PLACEHOLDERS[link.provider]}
                  aria-label={`${providerLabel} — identificador ou link do perfil`}
                  aria-describedby={providerHelp ? helpId : undefined}
                  aria-invalid={error ? true : undefined}
                />
              </div>
              {providerHelp ? <p id={helpId} className="text-sm text-muted-foreground">{providerHelp}</p> : null}
              {link.url ? <p className="truncate text-sm text-muted-foreground" title={link.url}>Endereço derivado: <span className="tabular-nums text-foreground">{link.url}</span></p> : null}
            </div>
          );
        })}
      </div>
      <div className="group/visibility border-t border-border pt-3">
        <label htmlFor={sharingId} className="flex cursor-pointer items-start gap-3 rounded-lg has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-warning">
          <VisibilityIcon />
          <span className="min-w-0 flex-1 py-0.5">
            <span className="block text-sm font-semibold">Compartilhar redes sociais futuramente?</span>
            <span aria-hidden="true" className="block text-sm text-muted-foreground">
              {shareSocialLinks ? 'Será visível no EventMatch' : 'Só você vê'}
            </span>
            <span id={`${sharingId}-description`} className="sr-only">Ative para mostrar a pessoas autenticadas quando esse recurso estiver disponível.</span>
          </span>
          <span className="relative mt-1 shrink-0">
            <input
              id={sharingId}
              type="checkbox"
              role="switch"
              name="socialLinksVisibility"
              value="authenticated"
              checked={shareSocialLinks}
              onChange={(event) => updateSharing(event.target.checked)}
              aria-describedby={`${sharingId}-description`}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="relative block h-7 w-12 rounded-full border-2 border-muted-foreground bg-card transition-colors after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-muted-foreground after:content-[''] after:transition-[transform,background-color] after:duration-200 after:ease-out peer-checked:border-primary peer-checked:bg-primary peer-checked:after:translate-x-5 peer-checked:after:bg-primary-foreground"
            />
          </span>
        </label>
      </div>
      {error ? <p id={errorId} className="font-semibold text-error" role="alert">{error}</p> : null}
    </section>
  );
}
