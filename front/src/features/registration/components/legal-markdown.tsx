import type { ComponentProps, ReactNode } from 'react';
import Markdown, { type Components } from 'react-markdown';

/**
 * Server Component (ADR-029): `react-markdown` never reaches the client bundle. HTML in the source
 * is dropped, images are not rendered and only `https:` and `mailto:` links stay clickable.
 */

const TITLE_LINE = /^\s*#[ \t]+[^\n]*\n?/;

/** The document title is the step's `h2`; the leading `#` of the body would repeat it. */
function withoutTitle(source: string): string {
  return source.replace(TITLE_LINE, '');
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

const heading = (Tag: 'h3' | 'h4' | 'h5', className: string) =>
  function Heading({ children }: ComponentProps<'h3'>) {
    return <Tag className={className}>{children}</Tag>;
  };

const COMPONENTS: Components = {
  h1: heading('h3', 'mt-6 mb-2 font-display text-lg font-bold text-foreground first:mt-0'),
  h2: heading('h3', 'mt-6 mb-2 font-display text-lg font-bold text-foreground first:mt-0'),
  h3: heading('h4', 'mt-5 mb-1.5 text-base font-bold text-foreground'),
  h4: heading('h5', 'mt-4 mb-1 text-base font-semibold text-foreground'),
  h5: heading('h5', 'mt-4 mb-1 text-base font-semibold text-foreground'),
  h6: heading('h5', 'mt-4 mb-1 text-base font-semibold text-foreground'),
  p: ({ children }) => <p className="my-3">{children}</p>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1.5 ps-6">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1.5 ps-6">{children}</ol>,
  strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
  blockquote: ({ children }) => <blockquote className="my-3 border-s border-border ps-4">{children}</blockquote>,
  hr: () => <hr className="my-5 border-border" />,
  img: () => null,
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
    <Markdown skipHtml components={COMPONENTS} urlTransform={(url) => url}>
      {withoutTitle(source)}
    </Markdown>
  );
}
