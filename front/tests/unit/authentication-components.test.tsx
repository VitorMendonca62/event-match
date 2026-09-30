import { describe, expect, mock, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

mock.module('next/navigation', () => ({
  useRouter: () => ({ replace: () => {}, refresh: () => {}, push: () => {} }),
}));

const { LoginForm } = await import('../../src/features/authentication/components/login-form');
const { LogoutButton } = await import('../../src/features/authentication/components/logout-button');
const { AUTH_MESSAGES, loginOutcome, messageForLogin } = await import('../../src/features/authentication/messages');

function text(markup: string): string {
  return markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

describe('login form (ADR-037)', () => {
  const markup = renderToStaticMarkup(<LoginForm />);

  test('uses persistent labels and the browser credential autocomplete', () => {
    expect(markup).toMatch(/<label[^>]*>E-mail<\/label>/);
    expect(markup).toMatch(/<label[^>]*>Senha<\/label>/);
    expect(markup).toMatch(/autocomplete="username"/i);
    expect(markup).toMatch(/autocomplete="current-password"/i);
    expect(markup).toContain('type="password"');
  });

  test('“Manter conectado” starts unchecked and explains the 30 days', () => {
    expect(markup).toMatch(/<input[^>]*name="rememberMe"[^>]*>/);
    expect(markup).not.toMatch(/<input[^>]*name="rememberMe"[^>]*checked/);
    expect(text(markup)).toContain('até 30 dias');
  });

  test('never falls back to a GET that would put credentials in the URL', () => {
    expect(markup).toContain('method="post"');
    expect(markup).toContain('action="/api/auth/login"');
  });

  test('has a single submit and no password recovery link', () => {
    expect(markup.match(/type="submit"/g)).toHaveLength(1);
    expect(markup).not.toMatch(/href="[^"]*(recuperar|senha|reset)/i);
  });

  test('logout is a real button', () => {
    expect(renderToStaticMarkup(<LogoutButton />)).toMatch(/<button[^>]*type="button"[^>]*>.*Sair/);
  });
});

describe('neutral login copy (SDD-013 §4.5)', () => {
  test('maps statuses conservatively', () => {
    expect(loginOutcome(200)).toBe('ok');
    expect(loginOutcome(400)).toBe('invalid');
    expect(loginOutcome(401)).toBe('invalid');
    expect(loginOutcome(429)).toBe('rate_limited');
    for (const status of [0, 403, 404, 500, 502, 503]) expect(loginOutcome(status)).toBe('unavailable');
  });

  test('uses the approved texts and never mentions account existence, state or restriction', () => {
    expect(messageForLogin('invalid')).toBe('Não foi possível entrar. Confira os dados e tente novamente.');
    expect(messageForLogin('rate_limited')).toBe('Não foi possível entrar agora. Aguarde um pouco e tente novamente.');
    const all = Object.values(AUTH_MESSAGES).join(' ').toLowerCase();
    for (const word of ['não existe', 'não encontrad', 'bloquead', 'suspens', 'desativad', 'excluíd', 'tentativas restantes']) {
      expect(all).not.toContain(word);
    }
  });
});

describe('server boundaries of the new routes', () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

  test('/entrar and /inicio are Server Components; only the islands are client code', () => {
    for (const page of ['src/app/entrar/page.tsx', 'src/app/inicio/page.tsx', 'src/app/cadastro/concluido/page.tsx']) {
      expect(read(page)).not.toContain("'use client'");
    }
    for (const island of ['login-form', 'logout-button', 'session-keeper']) {
      expect(read(`src/features/authentication/components/${island}.tsx`).startsWith("'use client'")).toBe(true);
    }
  });

  test('client islands never import server-only modules nor receive account data', () => {
    for (const island of ['login-form', 'logout-button', 'session-keeper']) {
      const source = read(`src/features/authentication/components/${island}.tsx`);
      expect(source).not.toMatch(/shared\/server|shared\/config|next\/headers/);
    }
    const home = read('src/app/inicio/page.tsx');
    expect(home).not.toMatch(/accountId|email|displayName/);
    expect(home).toMatch(/<SessionKeeper \/>/);
    expect(home).toMatch(/<LogoutButton \/>/);
  });

  test('no auth setting is exposed through NEXT_PUBLIC_', () => {
    for (const file of ['src/shared/config/bff-env.server.ts', 'src/shared/server/authentication-bff.ts']) {
      expect(read(file)).not.toMatch(/process\.env\.NEXT_PUBLIC_|NEXT_PUBLIC_AUTH/);
    }
  });

  test('the completed registration offers login only behind the flag and never signs in', () => {
    const source = read('src/app/cadastro/concluido/page.tsx');
    expect(source).toContain('href="/entrar"');
    expect(source).toContain('Entrar no EventMatch');
    expect(source).toContain('AUTH_UI_ENABLED');
    expect(source).not.toContain('/api/auth/login');
  });
});
