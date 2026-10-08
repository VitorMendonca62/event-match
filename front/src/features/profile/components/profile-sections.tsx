'use client';

import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import type { OwnProfile } from '../contracts';
import { profileScrollBehavior } from '../profile-motion';

function scrollBehavior(): ScrollBehavior {
  return profileScrollBehavior(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

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
      className="space-y-10 border-t border-border pt-10 first-of-type:border-t-0 first-of-type:pt-0"
    >
      <div>
        <h2 id={headingId} tabIndex={-1} className="font-display text-2xl font-black uppercase leading-[0.95] tracking-[-0.02em] [word-spacing:0.14em] text-balance poster-stretch sm:text-3xl">
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

/** The active block is the last one whose top has crossed the upper third of the viewport. */
function currentGroup(): GroupAnchor {
  const threshold = window.innerHeight / 3;
  let current: GroupAnchor = PROFILE_GROUPS[0].anchor;
  for (const { anchor } of PROFILE_GROUPS) {
    const section = document.getElementById(anchor);
    if (section && section.getBoundingClientRect().top <= threshold) current = anchor;
  }
  return current;
}

/**
 * In-page index. Desktop: vertical list in the sticky sidebar with each block's saved status.
 * Mobile: a sticky horizontal strip so long scrolls keep a way to jump between blocks.
 */
export function ProfileSectionNav({ profile }: Readonly<{ profile: OwnProfile }>) {
  const [active, setActive] = useState<GroupAnchor>(PROFILE_GROUPS[0].anchor);
  const listRef = useRef<HTMLOListElement>(null);
  // While a nav click animates the page, the observer would light up every block passed on the way.
  const scrollingToRef = useRef<GroupAnchor | null>(null);

  useEffect(() => {
    const sections = PROFILE_GROUPS.map(({ anchor }) => document.getElementById(anchor)).filter((node): node is HTMLElement => node !== null);
    const observer = new IntersectionObserver(() => {
      if (!scrollingToRef.current) setActive(currentGroup());
    }, { rootMargin: '0px 0px -66% 0px', threshold: [0, 1] });
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, []);

  // Mobile strip scrolls horizontally; keep the current block's link in view without moving the page.
  useEffect(() => {
    const list = listRef.current;
    const link = list?.querySelector<HTMLElement>('[aria-current]');
    if (!list || !link || list.scrollWidth <= list.clientWidth) return;
    list.scrollTo({ left: link.offsetLeft - list.offsetLeft - 20, behavior: scrollBehavior() });
  }, [active]);

  function goToGroup(event: MouseEvent<HTMLAnchorElement>, anchor: GroupAnchor) {
    // Keep native behavior for new-tab/window clicks.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const section = document.getElementById(anchor);
    if (!section) return;
    event.preventDefault();
    scrollingToRef.current = anchor;
    setActive(anchor);
    // Crossings skipped during the animation are settled once from the final position.
    let timeout = 0;
    const release = (event?: Event) => {
      // Only the page's scroll counts (the mobile strip emits its own `scrollend`), and only once
      // it has reached the target; anything else waits for the next one or the timeout.
      if (event && (event.target !== document || currentGroup() !== anchor)) return;
      window.clearTimeout(timeout);
      window.removeEventListener('scrollend', release);
      // A newer click owns the lock; let it settle the state.
      if (scrollingToRef.current !== anchor) return;
      scrollingToRef.current = null;
      setActive(currentGroup());
    };
    // `scrollend` is the precise signal; the timeout covers browsers without it or no-op scrolls.
    window.addEventListener('scrollend', release);
    timeout = window.setTimeout(() => release(), 2000);
    section.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    window.history.pushState(null, '', `#${anchor}`);
    // Move keyboard and screen reader focus to the block without a second jump.
    section.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }

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
                onClick={(event) => goToGroup(event, anchor)}
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
