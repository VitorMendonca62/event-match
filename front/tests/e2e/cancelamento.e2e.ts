import { advanceTo, expectLanding, expectStep, fillBirth, fillEmail, TITLES, uniqueEmail } from './support/flow';
import { expect, test } from './support/test';

test('8. cancelar após a senha volta ao início e libera o e-mail', async ({ page }) => {
  const email = uniqueEmail('cancela');
  await advanceTo(page, email, 'password');

  // Holds the DELETE so the pending state can be observed: no second click while it runs.
  // (No function-type annotations here: Playwright's loader under Bun fails to build them.)
  const hold = Promise.withResolvers();
  await page.route('**/api/registration', async (route) => {
    if (route.request().method() === 'DELETE') await hold.promise;
    await route.continue();
  });

  await page.getByRole('button', { name: 'Cancelar cadastro' }).click();
  await page.getByRole('button', { name: 'Sim, cancelar' }).click();
  await expect(page.getByRole('button', { name: 'Cancelando…' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Continuar cadastro' })).toBeDisabled();
  hold.resolve(undefined);
  await expect(page).toHaveURL(/\/$/);
  await page.unroute('**/api/registration');
  expect(await page.evaluate(() => window.sessionStorage.length)).toBe(0);

  // The same contact can start again right away (ADR-030).
  await page.goto('/cadastro');
  await expectLanding(page, TITLES.birth);
  await fillBirth(page);
  await expectStep(page, TITLES.contact);
  await fillEmail(page, email);
  await expectStep(page, TITLES.otp);
});
