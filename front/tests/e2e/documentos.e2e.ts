import { documentButton, expectFocusInside } from './support/dialogs';
import { publishTermsVersion } from './support/db';
import {
  acceptAllDocuments,
  advanceTo,
  chooseInterests,
  expectStep,
  fillRequiredData,
  finish,
  goToReview,
  TITLES,
  uniqueEmail,
} from './support/flow';
import { expect, test } from './support/test';

const TERMS = 'Termos de Uso';

test('9. recusa: Rever documentos reabre o mesmo documento com foco dentro; Cancelar encerra', async ({ page }) => {
  await advanceTo(page, uniqueEmail('recusa'), 'password');

  await documentButton(page, TERMS).click();
  const termsDialog = page.getByRole('dialog', { name: TERMS });
  await expect(termsDialog).toBeVisible();
  await expectFocusInside(termsDialog);

  await termsDialog.getByRole('button', { name: /^Recusar/ }).click();
  const refusal = page.getByRole('alertdialog');
  await expect(refusal).toBeVisible();
  await expect(refusal.getByRole('heading', { name: 'Sem os três aceites, sua conta não é ativada' })).toBeVisible();
  await expectFocusInside(refusal);

  await refusal.getByRole('button', { name: 'Rever documentos' }).click();
  await expect(refusal).toBeHidden();
  const reopened = page.getByRole('dialog', { name: TERMS });
  await expect(reopened).toBeVisible();
  await expectFocusInside(reopened);

  // Esc closes and hands focus back to the link that opened it.
  await page.keyboard.press('Escape');
  await expect(reopened).toBeHidden();
  await expect(documentButton(page, TERMS)).toBeFocused();

  await documentButton(page, TERMS).click();
  await page.getByRole('dialog', { name: TERMS }).getByRole('button', { name: /^Recusar/ }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar cadastro' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('10. nova versão publicada no meio do fluxo exige novo aceite', async ({ page }) => {
  await advanceTo(page, uniqueEmail('versao'), 'requiredData');

  await publishTermsVersion('terms');
  await fillRequiredData(page);
  await expectStep(page, TITLES.interests);
  await expect(page.getByRole('status').filter({ hasText: 'Documentos atualizados' })).toBeVisible();

  await chooseInterests(page, 3);
  await goToReview(page);
  await expectStep(page, TITLES.review);
  await expect(page.getByRole('heading', { name: 'Confirme os documentos' })).toBeVisible();
  await acceptAllDocuments(page);
  await finish(page);
  await expect(page).toHaveURL(/\/cadastro\/concluido$/);
});
