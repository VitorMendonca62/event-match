import { fullCheck, overflowCheck, walkRegistration } from './support/a11y-walk';
import { expectLanding, fillBirth, MINOR_BIRTH_DATE, TITLES } from './support/flow';
import { expect, expectNoHorizontalScroll, expectNoSeriousA11yViolations, test } from './support/test';

test('14. axe sem violações graves e sem rolagem horizontal em cada etapa', async ({ page }) => {
  await walkRegistration(page, fullCheck);
});

test('14b. com zoom de 200% (640×400 px CSS) não há rolagem horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 400 });
  await walkRegistration(page, overflowCheck);
});

test('14c. recusa de menor de idade: acessível e sem rolagem horizontal', async ({ page }) => {
  await page.goto('/cadastro');
  await fillBirth(page, MINOR_BIRTH_DATE);
  await expect(page.getByRole('status').filter({ hasText: 'Cadastro indisponível' })).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  await expectNoHorizontalScroll(page);
});

test('14d. estrutura acessível da etapa de nascimento', async ({ page }) => {
  await page.goto('/cadastro');
  await expectLanding(page, TITLES.birth);
  await expect(page.getByRole('main')).toMatchAriaSnapshot(`
    - region "${TITLES.birth}":
      - heading "${TITLES.birth}" [level=1]
      - textbox "Data de nascimento"
      - button "Continuar"
  `);
});
