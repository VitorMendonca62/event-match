'use client';

import { type MouseEvent, useEffect, useRef, useState } from 'react';

export const EVENT_FORM_SECTIONS = [
  { anchor: 'event-proposta', label: 'Proposta' },
  { anchor: 'event-onde', label: 'Onde' },
  { anchor: 'event-quando', label: 'Quando' },
  { anchor: 'event-vagas', label: 'Vagas' },
  { anchor: 'event-entrada', label: 'Entrada' },
] as const;

export type EventFormSectionAnchor = (typeof EVENT_FORM_SECTIONS)[number]['anchor'];
export type EventSectionNavStatus = Readonly<{ text: string; pending: boolean }>;
export type EventSectionNavStatuses = Readonly<Record<EventFormSectionAnchor, EventSectionNavStatus>>;

function currentSection(): EventFormSectionAnchor {
  const threshold = window.innerHeight / 3;
  let current: EventFormSectionAnchor = EVENT_FORM_SECTIONS[0].anchor;
  for (const { anchor } of EVENT_FORM_SECTIONS) {
    const section = document.getElementById(anchor);
    if (section && section.getBoundingClientRect().top <= threshold) current = anchor;
  }
  return current;
}

export function EventSectionNav({ statuses }: Readonly<{ statuses: EventSectionNavStatuses }>) {
  const [active, setActive] = useState<EventFormSectionAnchor>(EVENT_FORM_SECTIONS[0].anchor);
  const listRef = useRef<HTMLOListElement>(null);
  const scrollingToRef = useRef<EventFormSectionAnchor | null>(null);

  useEffect(() => {
    const sections = EVENT_FORM_SECTIONS.map(({ anchor }) => document.getElementById(anchor)).filter((node): node is HTMLElement => node !== null);
    const observer = new IntersectionObserver(() => {
      if (!scrollingToRef.current) setActive(currentSection());
    }, { rootMargin: '0px 0px -66% 0px', threshold: [0, 1] });
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const list = listRef.current;
    const link = list?.querySelector<HTMLElement>('[aria-current]');
    if (!list || !link || list.scrollWidth <= list.clientWidth) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    list.scrollTo({ left: link.offsetLeft - list.offsetLeft - 20, behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [active]);

  function goToSection(event: MouseEvent<HTMLAnchorElement>, anchor: EventFormSectionAnchor) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const section = document.getElementById(anchor);
    if (!section) return;
    event.preventDefault();
    scrollingToRef.current = anchor;
    setActive(anchor);
    let timeout = 0;
    const release = (scrollEvent?: Event) => {
      if (scrollEvent && (scrollEvent.target !== document || currentSection() !== anchor)) return;
      window.clearTimeout(timeout);
      window.removeEventListener('scrollend', release);
      if (scrollingToRef.current !== anchor) return;
      scrollingToRef.current = null;
      setActive(currentSection());
    };
    window.addEventListener('scrollend', release);
    timeout = window.setTimeout(() => release(), 2000);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    section.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    window.history.pushState(null, '', `#${anchor}`);
    section.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }

  return (
    <nav aria-label="Etapas do encontro" className="sticky top-0 z-20 -mx-5 border-b border-border bg-background px-5 sm:-mx-8 sm:px-8 lg:static lg:mx-0 lg:border-b-0 lg:bg-transparent lg:px-0">
      <ol ref={listRef} className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none] lg:flex-col lg:gap-0 lg:overflow-visible lg:py-0">
        {EVENT_FORM_SECTIONS.map(({ anchor, label }) => {
          const status = statuses[anchor];
          const current = anchor === active;
          return (
            <li key={anchor} className="shrink-0">
              <a
                href={`#${anchor}`}
                aria-current={current ? 'location' : undefined}
                onClick={(event) => goToSection(event, anchor)}
                className={`flex min-h-11 items-center gap-3 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors lg:min-h-0 lg:items-start lg:rounded-none lg:border-l lg:py-3 lg:ps-4 lg:pe-0 lg:text-base lg:whitespace-normal ${
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
