import { describe, expect, test } from 'bun:test';
import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { IntroPoster } from '../../src/features/registration/components/intro-poster';
import { ProgressRail } from '../../src/features/registration/components/progress-rail';
import { ContactStep } from '../../src/features/registration/components/steps/contact-step';
import { InterestsStep } from '../../src/features/registration/components/steps/interests-step';
import { LegalStep, RefusalNotice } from '../../src/features/registration/components/steps/legal-step';

const headingRef = createRef<HTMLHeadingElement>();
const noop = () => {};
const onFailure = async () => null;
const UUID = (n: number) => `0192f4c4-7d1a-7b8e-9d3f-3a6c1e2b4f5${n}`;

function text(markup: string): string {
  return markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

describe('intro poster (Convite Cívico)', () => {
  const markup = renderToStaticMarkup(<IntroPoster />);
  const copy = text(markup);

  test('explains purpose, 18+ and the non-dating stance before any data', () => {
    expect(copy).toContain('amizades');
    expect(copy).toContain('companhia');
    expect(copy).toContain('descobrir a cidade');
    expect(copy).toContain('18+');
    expect(copy).toContain('Não é app de namoro.');
    expect(markup).not.toContain('<input');
    expect(markup).not.toContain('<form');
  });

  test('offers a single primary action and no romantic copy', () => {
    expect(markup.match(/href="\/cadastro"/g)).toHaveLength(1);
    expect(copy).toContain('Começar meu cadastro');
    expect(copy.toLowerCase()).not.toContain('paixões');
    expect(copy).toContain('Interesses em comum.');
  });

  test('never serializes hex colors outside the global tokens', () => {
    expect(markup).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

describe('contact step', () => {
  const markup = renderToStaticMarkup(<ContactStep headingRef={headingRef} onFailure={onFailure} onRequested={noop} />);

  test('shows WhatsApp as disabled “Em breve” with no phone field', () => {
    expect(markup).toMatch(/value="whatsapp"[^>]*disabled|disabled[^>]*value="whatsapp"/);
    expect(text(markup)).toContain('Em breve');
    expect(markup).not.toContain('type="tel"');
  });

  test('links hints and explains why the e-mail is requested', () => {
    expect(markup).toContain('autoComplete="email"');
    expect(text(markup)).toContain('código de 6 dígitos');
  });
});

describe('progress rail', () => {
  test('announces progress in text, not only color', () => {
    const copy = text(renderToStaticMarkup(<ProgressRail current="otp" />));
    expect(copy).toContain('Etapa 3 de 8');
    expect(copy).toContain('Idade: concluída');
    expect(copy).toContain('Código: atual');
    expect(copy).toContain('Senha: pendente');
  });
});

describe('legal step', () => {
  test('blocks activation when the contract has no approved content', () => {
    const markup = renderToStaticMarkup(
      <LegalStep
        headingRef={headingRef}
        documents={{
          status: 'ready',
          items: [{ id: UUID(1), kind: 'terms', version: '2026-10-01', effectiveAt: '2026-10-01T00:00:00.000Z' }],
        }}
        accepted={[]}
        onAcceptedChange={noop}
        onContinue={noop}
        onExit={noop}
        onRetry={noop}
        retrying={false}
      />,
    );
    expect(text(markup)).toContain('Ainda não é possível concluir o cadastro');
    expect(markup).not.toContain('type="checkbox"');
    expect(markup).toMatch(/<button[^>]*\sdisabled=""/);
  });

  test('labels fixture content as test-only', () => {
    const items = (['terms', 'privacy', 'community_rules'] as const).map((kind, index) => ({
      id: UUID(index),
      kind,
      version: '1',
      effectiveAt: '2026-10-01T00:00:00.000Z',
      body: <p>Lorem ipsum.</p>,
      fixture: true,
    }));
    const markup = renderToStaticMarkup(
      <LegalStep
        headingRef={headingRef}
        documents={{ status: 'ready', items }}
        accepted={[]}
        onAcceptedChange={noop}
        onContinue={noop}
        onExit={noop}
        onRetry={noop}
        retrying={false}
      />,
    );
    expect(text(markup)).toContain('Conteúdo de teste — aceite sem efeito');
    expect(markup.match(/type="checkbox"/g)).toHaveLength(3);
  });
});

describe('legal step acceptance and refusal', () => {
  const kinds = ['terms', 'privacy', 'community_rules'] as const;
  const items = kinds.map((kind, index) => ({
    id: UUID(index),
    kind,
    version: '1.0.0',
    effectiveAt: '2026-09-28T00:00:00.000Z',
    body: <p>Texto {kind}</p>,
  }));
  const render = (accepted: string[] = []) =>
    renderToStaticMarkup(
      <LegalStep
        headingRef={headingRef}
        documents={{ status: 'ready', items }}
        accepted={accepted}
        onAcceptedChange={noop}
        onContinue={noop}
        onExit={noop}
        onRetry={noop}
        retrying={false}
      />,
    );

  test('unblocks the step with the three documents; checkboxes start unchecked', () => {
    const markup = render();
    expect(text(markup)).not.toContain('Ainda não é possível concluir o cadastro');
    expect(markup.match(/type="checkbox"/g)).toHaveLength(3);
    expect(markup).not.toMatch(/checked=""/);
    expect(markup).not.toMatch(/<button[^>]*\sdisabled=""/);
    expect(markup).toContain('Texto terms');
  });

  test('titles follow the DER and every control has a distinct accessible name', () => {
    const markup = render();
    for (const title of ['Termos de Uso', 'Política de Privacidade', 'Regras de Convivência']) {
      expect(markup).toContain(`Li e aceito: ${title}`);
      expect(markup).toContain(`aria-label="Não aceito: ${title}"`);
      expect(markup).toContain(`aria-label="Texto: ${title}"`);
    }
    expect(markup).not.toContain('Regras da Comunidade');
    expect(markup.match(/role="region"[^>]*tabindex="0"|tabindex="0"[^>]*role="region"/g)).toHaveLength(3);
  });

  test('reflects accepted documents', () => {
    expect(render([UUID(0)]).match(/checked=""/g)).toHaveLength(1);
  });

  test('a missing document keeps the step blocked and safe', () => {
    const markup = renderToStaticMarkup(
      <LegalStep
        headingRef={headingRef}
        documents={{ status: 'ready', items: items.slice(0, 2) }}
        accepted={[]}
        onAcceptedChange={noop}
        onContinue={noop}
        onExit={noop}
        onRetry={noop}
        retrying={false}
      />,
    );
    expect(text(markup)).toContain('Ainda não é possível concluir o cadastro');
    expect(text(markup)).toContain('Não disponível no momento.');
    expect(markup).toMatch(/<button[^>]*\sdisabled=""/);
  });

  test('the refusal notice explains the consequence and offers both exits', () => {
    const markup = renderToStaticMarkup(<RefusalNotice onReview={noop} onExit={noop} />);
    expect(markup).toContain('role="status"');
    expect(text(markup)).toContain('Sem os três aceites, sua conta não é ativada');
    expect(text(markup)).toContain('Nenhum aceite foi registrado');
    expect(text(markup)).toContain('Rever documentos');
    expect(text(markup)).toContain('Sair do cadastro');
  });
});

describe('interests step', () => {
  test('shows a textual counter and keeps the action perceivably unavailable below three', () => {
    const markup = renderToStaticMarkup(
      <InterestsStep
        headingRef={headingRef}
        interests={{ status: 'ready', items: [1, 2, 3, 4].map((n) => ({ id: UUID(n), label: `Interesse ${n}` })) }}
        selected={[UUID(1)]}
        onSelectedChange={noop}
        onBack={noop}
        onContinue={noop}
        onRetry={noop}
        retrying={false}
      />,
    );
    expect(text(markup)).toContain('1 interesse escolhido · faltam 2');
    expect(markup).toContain('aria-disabled="true"');
  });
});
