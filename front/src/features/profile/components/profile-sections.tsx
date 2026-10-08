'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { OwnProfile } from '../contracts';

export const PROFILE_GROUPS = [
  { anchor: 'sobre-voce', label: 'Sobre você' },
  { anchor: 'identidade', label: 'Identidade e comunicação' },
  { anchor: 'interesses', label: 'Interesses e encontros' },
  { anchor: 'agenda', label: 'Quando e até onde' },
] as const;

type GroupAnchor = (typeof PROFILE_GROUPS)[number]['anchor'];

/** Top-level block of the profile form; the nav links to its anchor. */
export function ProfileGroup({
  anchor,
  headingId,
  title,
  intro,
  introId,
  children,
}: Readonly<{
  anchor: GroupAnchor;
  headingId: string;
  title: string;
  intro?: ReactNode;
  introId?: string;
  children: ReactNode;
}>) {
  return (
    <section
      id={anchor}
      aria-labelledby={headingId}
      className="scroll-mt-24 space-y-10 border-t border-border pt-10 first-of-type:border-t-0 first-of-type:pt-0 lg:scroll-mt-10"
    >
      <div>
        <h2 id={headingId} className="font-display text-2xl font-black uppercase leading-[0.95] tracking-[-0.02em] [word-spacing:0.14em] text-balance poster-stretch sm:text-3xl">
          {title}
        </h2>
        {intro ? <p id={introId} className="mt-2 max-w-[65ch] text-muted-foreground">{intro}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Saved-state summary per block; reflects the last save, never the unsaved draft. */
function groupStatus(anchor: GroupAnchor, profile: OwnProfile): Readonly<{ text: string; pending: boolean }> {
  const missing = new Set(profile.completion.missing);
  if (anchor === 'sobre-voce') {
    const gaps = [missing.has('photo') && 'foto', missing.has('presentation') && 'apresentação', (missing.has('display_name') || missing.has('location')) && 'dados básicos'].filter(Boolean);
    return gaps.length ? { text: `Falta ${gaps.join(' e ')}`, pending: true } : { text: 'Completo', pending: false };
  }
  if (anchor === 'identidade') {
    const filled = [profile.pronounSelection, profile.profession, profile.languages.length, profile.socialLinks.length].filter(Boolean).length;
    return { text: filled ? `${filled} de 4 preenchidos · opcional` : 'Opcional', pending: false };
  }
  if (anchor === 'interesses') {
    if (missing.has('interests') || missing.has('usage_intents')) return { text: 'Escolha objetivos e 3 interesses', pending: true };
    return { text: `${profile.interests.length} interesses · ${profile.activityPreferences.length} preferências`, pending: false };
  }
  const slots = profile.availabilitySlots.length;
  return { text: slots ? `${slots} ${slots === 1 ? 'período' : 'períodos'} · só você vê` : 'Opcional · só você vê', pending: false };
}

/**
 * In-page index. Desktop: vertical list in the sticky sidebar with each block's saved status.
 * Mobile: a sticky horizontal strip so long scrolls keep a way to jump between blocks.
 */
export function ProfileSectionNav({ profile }: Readonly<{ profile: OwnProfile }>) {
  const [active, setActive] = useState<GroupAnchor>(PROFILE_GROUPS[0].anchor);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const sections = PROFILE_GROUPS.map(({ anchor }) => document.getElementById(anchor)).filter((node): node is HTMLElement => node !== null);
    // The active block is the last one whose top has crossed the upper third of the viewport.
    const observer = new IntersectionObserver(() => {
      const threshold = window.innerHeight / 3;
      let current: GroupAnchor = PROFILE_GROUPS[0].anchor;
      for (const section of sections) if (section.getBoundingClientRect().top <= threshold) current = section.id as GroupAnchor;
      setActive(current);
    }, { rootMargin: '0px 0px -66% 0px', threshold: [0, 1] });
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, []);

  // Mobile strip scrolls horizontally; keep the current block's link in view without moving the page.
  useEffect(() => {
    const list = listRef.current;
    const link = list?.querySelector<HTMLElement>('[aria-current]');
    if (!list || !link || list.scrollWidth <= list.clientWidth) return;
    list.scrollTo({ left: link.offsetLeft - list.offsetLeft - 20 });
  }, [active]);

  return (
    <nav aria-label="Seções do perfil" className="sticky top-0 z-20 -mx-5 border-b border-border bg-background/95 px-5 backdrop-blur-sm sm:-mx-8 sm:px-8 lg:static lg:mx-0 lg:border-b-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none">
      <ol ref={listRef} className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none] lg:flex-col lg:gap-0 lg:overflow-visible lg:py-0">
        {PROFILE_GROUPS.map(({ anchor, label }) => {
          const status = groupStatus(anchor, profile);
          const current = anchor === active;
          return (
            <li key={anchor} className="shrink-0">
              <a
                href={`#${anchor}`}
                aria-current={current ? 'location' : undefined}
                onClick={() => setActive(anchor)}
                className={`flex min-h-11 items-center gap-3 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors lg:min-h-0 lg:items-start lg:rounded-none lg:border-l-2 lg:py-3 lg:ps-4 lg:pe-0 lg:text-base lg:whitespace-normal ${
                  current
                    ? 'bg-card text-foreground lg:border-primary lg:bg-transparent'
                    : 'text-muted-foreground hover:text-foreground lg:border-border lg:hover:border-muted-foreground'
                }`}
              >
                <span className="lg:min-w-0">
                  <span className="block">{label}</span>
                  <span className={`hidden text-sm font-normal lg:flex lg:items-center lg:gap-2 ${status.pending ? 'text-warning' : 'text-muted-foreground'}`}>
                    {status.pending ? <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-warning" /> : null}
                    {status.text}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
