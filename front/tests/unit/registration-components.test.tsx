import { describe, expect, test } from 'bun:test';
import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { IntroPoster } from '../../src/features/registration/components/intro-poster';
import { ProgressRail } from '../../src/features/registration/components/progress-rail';
import { ContactStep } from '../../src/features/registration/components/steps/contact-step';
import { InterestsStep } from '../../src/features/registration/components/steps/interests-step';
import { PasswordStep } from '../../src/features/registration/components/steps/password-step';
import { allAccepted, documentsReady, TermsConsent } from '../../src/features/registration/components/terms-consent';

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
    expect(copy).toContain('Etapa 3 de 7');
    expect(copy).toContain('Idade: concluída');
    expect(copy).toContain('Código: atual');
    expect(copy).toContain('Senha: pendente');
  });
});

describe('terms consent (ADR-031)', () => {
  const kinds = ['terms', 'privacy', 'community_rules'] as const;
  const items = kinds.map((kind, index) => ({ id: UUID(index), kind, body: <p>Texto {kind}</p> }));
  const render = (accepted: string[] = [], documents: Parameters<typeof TermsConsent>[0]['documents'] = { status: 'ready', items }) =>
    renderToStaticMarkup(
      <TermsConsent
        documents={documents}
        accepted={accepted}
        onAcceptedChange={noop}
        onCancel={noop}
        onRetry={noop}
        retrying={false}
      />,
    );

  test('shows “Li e concordo com …” with the document name as a link button, unchecked by default', () => {
    const markup = render();
    const copy = text(markup);
    expect(copy).toContain('Li e concordo com os Termos de Uso');
    expect(copy).toContain('Li e concordo com a Política de Privacidade');
    expect(copy).toContain('Li e concordo com as Regras de Convivência');
    expect(markup.match(/type="checkbox"/g)).toHaveLength(3);
    expect(markup).not.toMatch(/checked=""/);
    expect(markup).not.toContain('Regras da Comunidade');
  });

  test('never shows a version or validity date, and the texts sit inside closed dialogs', () => {
    const markup = render();
    expect(text(markup)).not.toMatch(/Versão|vigente|v1\.0\.0/);
    expect(markup.match(/<dialog/g)?.length).toBe(4);
    expect(markup).not.toMatch(/<dialog[^>]*\sopen=""/);
    expect(markup).toContain('Texto terms');
  });

  test('each dialog has a named title, a focusable reading region and Aceitar/Recusar controls', () => {
    const markup = render();
    for (const title of ['Termos de Uso', 'Política de Privacidade', 'Regras de Convivência']) {
      expect(markup).toContain(`aria-label="Texto: ${title}"`);
      expect(text(markup)).toContain(`Aceitar : ${title}`);
      expect(text(markup)).toContain(`Recusar : ${title}`);
    }
    expect(markup.match(/role="region"[^>]*tabindex="0"|tabindex="0"[^>]*role="region"/g)).toHaveLength(3);
    expect(markup.match(/aria-labelledby="/g)!.length).toBeGreaterThanOrEqual(7);
  });

  test('the refusal dialog explains the consequence and offers review or cancelling', () => {
    const markup = render();
    expect(markup).toContain('role="alertdialog"');
    const copy = text(markup);
    expect(copy).toContain('Sem os três aceites, sua conta não é ativada');
    expect(copy).toContain('Nenhum aceite foi registrado');
    expect(copy).toContain('Rever documentos');
    expect(copy).toContain('Cancelar cadastro');
  });

  test('reflects accepted documents', () => {
    expect(render([UUID(0)]).match(/checked=""/g)).toHaveLength(1);
    expect(allAccepted({ status: 'ready', items }, [UUID(0), UUID(1)])).toBe(false);
    expect(allAccepted({ status: 'ready', items }, [UUID(0), UUID(1), UUID(2)])).toBe(true);
    expect(allAccepted({ status: 'ready', items }, ['unknown', UUID(1), UUID(2)])).toBe(false);
  });

  test('a missing document blocks the step and is never invented', () => {
    const documents = { status: 'ready', items: items.slice(0, 2) } as const;
    const markup = render([], documents);
    expect(documentsReady(documents)).toBe(false);
    expect(text(markup)).toContain('Ainda não é possível concluir o cadastro');
    expect(markup.match(/type="checkbox"/g)).toHaveLength(2);
  });

  test('loading and unavailable states are announced', () => {
    expect(text(render([], { status: 'deferred' }))).toContain('Carregando documentos');
    expect(text(render([], { status: 'unavailable' }))).toContain('Documentos indisponíveis');
  });

  test('labels fixture content as test-only', () => {
    const fixtures = items.map((item) => ({ ...item, fixture: true }));
    expect(text(render([], { status: 'ready', items: fixtures }))).toContain('Conteúdo de teste — aceite sem efeito');
  });
});

describe('password step with documents', () => {
  const items = (['terms', 'privacy', 'community_rules'] as const).map((kind, index) => ({
    id: UUID(index),
    kind,
    body: <p>Texto {kind}</p>,
  }));
  const render = (documents: Parameters<typeof PasswordStep>[0]['documents']) =>
    renderToStaticMarkup(
      <PasswordStep
        headingRef={headingRef}
        onFailure={onFailure}
        onSaved={noop}
        documents={documents}
        accepted={[]}
        onAcceptedChange={noop}
        onCancel={noop}
        onRetry={noop}
        retrying={false}
      />,
    );

  test('asks for the password and the three acceptances on the same screen', () => {
    const copy = text(render({ status: 'ready', items }));
    expect(copy).toContain('Crie sua senha');
    expect(copy).toContain('Li e concordo com os Termos de Uso');
    expect(copy).toContain('Salvar senha');
  });

  test('keeps saving unavailable while the documents cannot be read', () => {
    expect(render({ status: 'deferred' })).toMatch(/<button[^>]*\sdisabled=""/);
    expect(render({ status: 'ready', items })).not.toMatch(/<button[^>]*type="submit"[^>]*\sdisabled=""/);
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
