import { retireCurrentDocuments } from './support/db';
import { confirmOtp, expectStep, fillBirth, fillEmail, TITLES, uniqueEmail } from './support/flow';
import { expect, test } from './support/test';

// Destructive project: it retires every approved document and therefore runs last (SDD-012 §8).
test('11. documentos ausentes bloqueiam a criação da senha', async ({ page }) => {
  const email = uniqueEmail('ausentes');
  await retireCurrentDocuments();

  await page.goto('/cadastro');
  await fillBirth(page);
  await expectStep(page, TITLES.contact);
  await fillEmail(page, email);
  await expectStep(page, TITLES.otp);
  await confirmOtp(page, email);
  await expectStep(page, TITLES.password);

  await expect(page.getByRole('status').filter({ hasText: 'Ainda não é possível concluir o cadastro' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvar senha' })).toBeDisabled();
});
