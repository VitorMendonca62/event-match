import type { ElementType, ReactNode } from 'react';

import { cn } from '@/shared/ui/cn';

type PosterHeadlineProps = Readonly<{
  /** Line set in foreground. */
  lead: ReactNode;
  /** Line set in the carmine poster ink. */
  accent: ReactNode;
  as?: ElementType;
  id?: string;
  size?: 'hero' | 'step';
  className?: string;
}>;

/** Two-ink uppercase headline of the civic poster; emphasis comes from weight, never gradient. */
export function PosterHeadline({ lead, accent, as: Tag = 'h1', id, size = 'hero', className }: PosterHeadlineProps) {
  return (
    <Tag
      id={id}
      className={cn(
        'font-display font-black uppercase leading-[0.9] tracking-[-0.02em] [word-spacing:0.12em] text-balance poster-stretch',
        size === 'hero' ? 'text-[clamp(2.75rem,11vw,5rem)]' : 'text-[clamp(2.25rem,7vw,3.75rem)]',
        className,
      )}
    >
      <span className="block text-foreground">{lead}</span>
      <span className="block text-primary">{accent}</span>
    </Tag>
  );
}
