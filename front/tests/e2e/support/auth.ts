import { type BrowserContext, type Cookie, expect, type Locator, type Page } from '@playwright/test';

import { advanceTo, finish, PASSWORD, uniqueEmail } from './flow';

/**
 * Login helpers for the SDD-013 specs. Typed code lives here because Playwright's loader under Bun
 * cannot build TypeScript syntax inside spec files (see `cancelamento.e2e.ts`).
 */

/** Local/test cookie name; production uses `__Host-eventmatch_session` (ADR-034). */
export const SESSION_COOKIE = 'eventmatch_session';
export const NEUTRAL_FAILURE = 'Não foi possível entrar. Confira os dados e tente novamente.';

/** A real account, created through the registration UI and left at `/cadastro/concluido`. */
export async function registerAccount(page: Page, label: string): Promise<string> {
  const email = uniqueEmail(label);
  await advanceTo(page, email, 'review');
  await finish(page);
  await expect(page).toHaveURL(/\/cadastro\/concluido$/);
  return email;
}

export async function signIn(
  page: Page,
  email: string,
  options: { password?: string; remember?: boolean } = {},
): Promise<void> {
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(options.password ?? PASSWORD);
  if (options.remember) await page.getByText('Manter conectado').click();
  await page.getByRole('button', { name: 'Entrar' }).click();
}

export async function sessionCookie(context: BrowserContext): Promise<Cookie | undefined> {
  return (await context.cookies()).find((cookie) => cookie.name === SESSION_COOKIE);
}

/** Like `sessionCookie`, but fails the test when the cookie is missing. */
export async function requireSessionCookie(context: BrowserContext): Promise<Cookie> {
  const cookie = await sessionCookie(context);
  if (!cookie) throw new Error('expected the session cookie to be set');
  return cookie;
}

export function welcome(page: Page): Locator {
  return page.getByRole('heading', { level: 1, name: /Você entrou/i });
}
