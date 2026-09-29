import { lastLink } from './support/brevo';
import { advanceTo, TITLES, uniqueEmail } from './support/flow';
import { expect, test } from './support/test';

test('2. link do e-mail confirma em outro contexto, com 303 limpo e uso único', async ({ page, browser, baseURL }) => {
  const email = uniqueEmail('link');
  await advanceTo(page, email, 'otp');
  const link = await lastLink(email);

  const other = await browser.newContext({ baseURL });
  const opened = await other.newPage();
  const response = await opened.goto(link);
  // The callback answers 303 and the person lands on a clean `/cadastro`, without the token.
  expect(response?.request().redirectedFrom()?.url()).toContain('token=');
  await expect(opened).toHaveURL(/\/cadastro$/);
  expect(opened.url()).not.toContain('token=');
  await expect(opened.getByRole('status').filter({ hasText: 'E-mail confirmado' })).toBeVisible();
  await expect(opened.getByRole('heading', { level: 1, name: TITLES.password })).toBeVisible();

  // Single use: a third context reusing the link gets the neutral failure.
  const third = await browser.newContext({ baseURL });
  const reused = await third.newPage();
  await reused.goto(link);
  await expect(reused.getByRole('status').filter({ hasText: 'Link não confirmado' })).toBeVisible();
  await expect(reused.getByRole('heading', { level: 1, name: TITLES.birth })).toBeVisible();

  await other.close();
  await third.close();
});
