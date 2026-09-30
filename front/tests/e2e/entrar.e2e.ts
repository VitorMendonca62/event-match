import {
  NEUTRAL_FAILURE,
  registerAccount,
  requireSessionCookie,
  SESSION_COOKIE,
  sessionCookie,
  signIn,
  welcome,
} from './support/auth';
import { idleNewestSession, makeNewestSessionDueForRotation, setNewestAccountStatus } from './support/db';
import { PASSWORD, uniqueEmail } from './support/flow';
import { expect, expectNoHorizontalScroll, expectNoSeriousA11yViolations, test } from './support/test';

// No TypeScript syntax in this file: Playwright's loader under Bun cannot build it (typed helpers
// live in `support/auth.ts`).

test('1. cadastro concluído não autentica; “Entrar no EventMatch” leva ao login e a /inicio', async ({ page, context }) => {
  const email = await registerAccount(page, 'entrar');
  expect(await sessionCookie(context)).toBeUndefined();

  await page.getByRole('link', { name: 'Entrar no EventMatch' }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByRole('checkbox', { name: /Manter conectado/ })).not.toBeChecked();
  await expectNoSeriousA11yViolations(page);
  await expectNoHorizontalScroll(page);

  await signIn(page, email);
  await expect(page).toHaveURL(/\/inicio$/);
  await expect(welcome(page)).toBeVisible();

  const cookie = await requireSessionCookie(context);
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/', expires: -1 });
  expect(cookie.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(await page.evaluate(() => document.cookie)).not.toContain(SESSION_COOKIE);
  const html = await page.content();
  expect(html).not.toContain(email);
  expect(html).not.toContain(cookie.value);

  // Next steps are plain text with a status tag, never links or buttons.
  for (const step of ['Completar perfil', 'Descobrir encontros']) {
    await expect(page.getByRole('listitem').filter({ hasText: step })).toContainText('Em breve');
    await expect(page.getByRole('link', { name: step })).toHaveCount(0);
    await expect(page.getByRole('button', { name: step })).toHaveCount(0);
  }
  await expectNoSeriousA11yViolations(page);
  await expectNoHorizontalScroll(page);

  // Refresh, direct URL and a new tab keep the session; /entrar sends a connected person home.
  await page.reload();
  await expect(welcome(page)).toBeVisible();
  const response = await page.goto('/inicio');
  expect(response?.headers()['cache-control']).toContain('no-store');
  const second = await context.newPage();
  await second.goto('/inicio');
  await expect(welcome(second)).toBeVisible();
  await second.goto('/entrar');
  await expect(second).toHaveURL(/\/inicio$/);
  await second.close();
});

test('2. falhas de login são neutras, focadas e não criam sessão', async ({ page, context }) => {
  const email = await registerAccount(page, 'neutra');
  await page.goto('/entrar');

  await signIn(page, uniqueEmail('ninguem'));
  const alert = page.getByRole('main').getByRole('alert');
  await expect(alert).toHaveText(new RegExp(NEUTRAL_FAILURE));
  await expect(alert).toBeFocused();
  await expect(page.getByLabel('Senha', { exact: true })).toHaveValue('');

  await signIn(page, email, { password: 'uma senha errada qualquer' });
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(new RegExp(NEUTRAL_FAILURE));

  await setNewestAccountStatus('suspended');
  await signIn(page, email);
  await expect(page.getByRole('main').getByRole('alert')).toHaveText(new RegExp(NEUTRAL_FAILURE));
  expect(await sessionCookie(context)).toBeUndefined();
  // Axe samples the resting state; the pointer is still over the button after the click.
  await page.mouse.move(0, 0);
  await expectNoSeriousA11yViolations(page);

  await page.goto('/inicio');
  await expect(page).toHaveURL(/\/entrar$/);
});

test('3. “Manter conectado” grava cookie persistente e a rotação troca o segredo sem expô-lo', async ({ page, context }) => {
  const email = await registerAccount(page, 'lembrar');
  await page.goto('/entrar');
  await signIn(page, email, { remember: true });
  await expect(welcome(page)).toBeVisible();

  const first = await requireSessionCookie(context);
  const days = (first.expires * 1000 - Date.now()) / 86_400_000;
  expect(days).toBeGreaterThan(29);
  expect(days).toBeLessThanOrEqual(30);

  await makeNewestSessionDueForRotation();
  const maintenance = await page.evaluate(async () => {
    const response = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
    return { status: response.status, body: await response.text(), header: response.headers.get('x-eventmatch-session') };
  });
  expect(maintenance.status).toBe(200);
  expect(maintenance.header).toBeNull();
  const rotated = await requireSessionCookie(context);
  expect(rotated.value).not.toBe(first.value);
  expect(maintenance.body).not.toContain(rotated.value);
  expect(rotated.expires).toBeCloseTo(first.expires, -1);

  await page.reload();
  await expect(welcome(page)).toBeVisible();
});

test('4. sair em uma aba invalida as outras, o histórico e o cookie antigo', async ({ page, context }) => {
  const email = await registerAccount(page, 'sair');
  await page.goto('/entrar');
  await signIn(page, email);
  await expect(welcome(page)).toBeVisible();
  const stolen = await requireSessionCookie(context);

  const other = await context.newPage();
  await other.goto('/inicio');
  await expect(welcome(other)).toBeVisible();

  await page.bringToFront();
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  expect(await sessionCookie(context)).toBeUndefined();

  // History does not bring the protected page back.
  await page.goBack();
  await expect(page).not.toHaveURL(/\/inicio$/);
  await expect(welcome(page)).toHaveCount(0);

  // The other tab leaves on its next focus.
  await other.bringToFront();
  await other.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(other).toHaveURL(/\/entrar$/);

  // Reusing the revoked secret does not authorize.
  await context.addCookies([{ ...stolen }]);
  await other.goto('/inicio');
  await expect(other).toHaveURL(/\/entrar$/);
  await other.close();
});

test('5. sessão ociosa expira no servidor e redireciona sem conteúdo protegido', async ({ page }) => {
  const email = await registerAccount(page, 'ociosa');
  await page.goto('/entrar');
  await signIn(page, email);
  await expect(welcome(page)).toBeVisible();

  await idleNewestSession();
  await page.reload();
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(welcome(page)).toHaveCount(0);
});

test('6. login e logout recusam requisições de outra origem (CSRF)', async ({ page, context }) => {
  await page.goto('/entrar');
  const body = JSON.stringify({ email: uniqueEmail('csrf'), password: PASSWORD, rememberMe: false });
  const foreign = await page.request.post('/api/auth/login', {
    headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
    data: body,
  });
  expect(foreign.status()).toBe(403);
  const form = await page.request.post('/api/auth/login', {
    headers: { origin: new URL(page.url()).origin, 'content-type': 'application/x-www-form-urlencoded' },
    data: 'email=a&password=b',
  });
  expect(form.status()).toBe(403);
  const logout = await page.request.post('/api/auth/logout', {
    headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
    data: '{}',
  });
  expect(logout.status()).toBe(403);
  expect(await sessionCookie(context)).toBeUndefined();
});

test('7. teclado: rótulos, ordem, envio por Enter e erro anunciado', async ({ page }) => {
  await page.goto('/entrar');
  await page.getByRole('button', { name: 'Entrar' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('E-mail')).toBeFocused();
  await expect(page.getByText('Informe o e-mail que você usou no cadastro.')).toBeVisible();

  await page.keyboard.type(uniqueEmail('teclado'));
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Senha', { exact: true })).toBeFocused();
  await page.keyboard.type('senha-que-nao-existe');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('checkbox', { name: /Manter conectado/ })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main').getByRole('alert')).toBeFocused();
  await expectNoSeriousA11yViolations(page);
});
