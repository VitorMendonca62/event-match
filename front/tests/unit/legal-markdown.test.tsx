import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { LegalMarkdown } from '../../src/features/registration/components/legal-markdown';
import { legalDocumentSchema } from '../../src/features/registration/contracts';

const render = (source: string) => renderToStaticMarkup(<LegalMarkdown source={source} />);

describe('LegalMarkdown (ADR-029)', () => {
  test('omits the leading title and shifts headings below the document h2', () => {
    const html = render('# Termos de Uso\n\n## 1. Objeto\n\nTexto **forte**.\n\n### 1.1 Detalhe\n');
    expect(html).not.toContain('Termos de Uso');
    expect(html).not.toContain('<h1');
    expect(html).not.toContain('<h2');
    expect(html).toContain('<h3');
    expect(html).toContain('1. Objeto</h3>');
    expect(html).toContain('<h4');
    expect(html).toContain('<strong');
  });

  test('renders lists without literal Markdown markers', () => {
    const html = render('# T\n\n- um\n- dois\n\n1. a\n2. b\n');
    expect(html).toContain('<ul');
    expect(html).toContain('<ol');
    expect(html).not.toContain('- um');
  });

  test('drops raw HTML and images', () => {
    const html = render('# T\n\n<script>alert(1)</script><div onclick="x()">oi</div>\n\n![logo](https://example.test/a.png)\n');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<div');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('<img');
  });

  test('https links open in a new tab with rel and an accessible notice', () => {
    const html = render('# T\n\nVeja [a lei](https://example.test/lei).');
    expect(html).toContain('href="https://example.test/lei"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('(abre em nova aba)');
  });

  test('mailto links stay in the same tab', () => {
    const html = render('# T\n\nEscreva para [suporte](mailto:suporte@example.test).');
    expect(html).toContain('href="mailto:suporte@example.test"');
    expect(html).not.toContain('target=');
  });

  test('http, javascript, data and relative targets become plain text', () => {
    const html = render(
      '# T\n\n[a](http://example.test) [b](javascript:alert(1)) [c](data:text/html;base64,AAAA) [d](/interno) [e](rel.md)\n',
    );
    expect(html).not.toContain('<a');
    expect(html).not.toContain('href=');
    for (const label of ['a', 'b', 'c', 'd', 'e']) expect(html).toContain(label);
  });

  test('escapes inline HTML instead of injecting it', () => {
    const html = render('# T\n\n&lt;b&gt; e <b>negrito</b>');
    expect(html).not.toContain('<b>');
  });
});

describe('legal document contract', () => {
  const base = {
    id: '019c0000-0000-7000-8000-000000000001',
    kind: 'terms',
    version: '1.0.0',
    locale: 'pt-BR',
    effectiveAt: '2026-09-28T00:00:00.000Z',
  };

  test('requires non-empty content', () => {
    expect(legalDocumentSchema.safeParse({ ...base, content: '# Termos' }).success).toBe(true);
    expect(legalDocumentSchema.safeParse(base).success).toBe(false);
    expect(legalDocumentSchema.safeParse({ ...base, content: '' }).success).toBe(false);
  });
});
