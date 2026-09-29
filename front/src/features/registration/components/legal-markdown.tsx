import type { ComponentProps, ReactNode } from 'react';
import Markdown, { type Components } from 'react-markdown';

/**
 * Server Component (ADR-029): `react-markdown` never reaches the client bundle. HTML in the source
 * is dropped, images are not rendered and only `https:` and `mailto:` links stay clickable.
 */

const TITLE_LINE = /^\s*#[ \t]+[^\n]*\n?/;
/** “**Versão 1.0.0 · Vigente a partir de … · Idioma: …**” plus the rule under it (ADR-031). */
const VERSION_LINE = /^\s*\*\*Versão [^\n]*\*\*[ \t]*\n(?:\s*---[ \t]*\n)?/;

/**
 * The document title is the dialog heading, and the version line is not shown to the person
 * (ADR-031). Only the display is trimmed: the stored text and its digest stay untouched.
 */
function withoutHeader(source: string): string {
  return source.replace(TITLE_LINE, '').replace(VERSION_LINE, '');
}

function safeHref(href: string | undefined): { href: string; external: boolean } | null {
  if (!href) return null;
  try {
    const url = new URL(href);
    if (url.protocol === 'https:') return { href: url.href, external: true };
    if (url.protocol === 'mailto:') return { href: url.href, external: false };
  } catch {
    // Relative and malformed targets become plain text.
  }
  return null;
}

/** ADR-029: anything else (images, code, tables, h5/h6) is unwrapped to its text. */
const ALLOWED_ELEMENTS = ['h1', 'h2', 'h3', 'h4', 'p', 'strong', 'em', 'ul', 'ol', 'li', 'blockquote', 'hr', 'br', 'a'];

const heading =(Tag: 'h3' | 'h4' | 'h5', className: string) =>
  function Heading({ children }: ComponentProps<'h3'>) {
    return <Tag className={className}>{children}</Tag>;
  };

const COMPONENTS: Components = {
  h1: heading('h3', 'mt-6 mb-2 font-display text-lg font-bold text-foreground first:mt-0'),
  h2: heading('h3', 'mt-6 mb-2 font-display text-lg font-bold text-foreground first:mt-0'),
  h3: heading('h4', 'mt-5 mb-1.5 text-base font-bold text-foreground'),
  h4: heading('h5', 'mt-4 mb-1 text-base font-semibold text-foreground'),
  p: ({ children }) => <p className="my-3">{children}</p>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1.5 ps-6">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1.5 ps-6">{children}</ol>,
  strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
  blockquote: ({ children }) => <blockquote className="my-3 border-s border-border ps-4">{children}</blockquote>,
  hr: () => <hr className="my-5 border-border" />,
  a: ({ href, children }) => {
    const target = safeHref(href);
    if (!target) return <>{children}</>;
    return target.external ? (
      <a
        href={target.href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-foreground underline underline-offset-4 hover:text-primary-hover"
      >
        {children}
        <span className="sr-only"> (abre em nova aba)</span>
      </a>
    ) : (
      <a href={target.href} className="text-foreground underline underline-offset-4 hover:text-primary-hover">
        {children}
      </a>
    );
  },
};

export function LegalMarkdown({ source }: Readonly<{ source: string }>): ReactNode {
  return (
    <Markdown
      skipHtml
      allowedElements={ALLOWED_ELEMENTS}
      unwrapDisallowed
      components={COMPONENTS}
      urlTransform={(url) => safeHref(url)?.href ?? ''}
    >
      {withoutHeader(source)}
    </Markdown>
  );
}
