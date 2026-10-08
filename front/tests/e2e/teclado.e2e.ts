import { lastOtp } from './support/brevo';
import { ADULT_BIRTH_DATE, DOCUMENT_TITLES, expectLanding, expectStep, PASSWORD, TITLES, uniqueEmail } from './support/flow';
import { expect, test } from './support/test';
import { tabTo, typeInto } from './support/keyboard';

test.skip(({ isMobile }) => isMobile, 'Keyboard-only journey targets desktop browsers.');


test('13. só teclado: caminho feliz inteiro com Tab, Enter, Espaço e Esc', async ({ page }) => {
  const email = uniqueEmail('teclado');
  await page.goto('/cadastro');
  await expectLanding(page, TITLES.birth);

  await tabTo(page, page.getByLabel('Data de nascimento'));
  await page.getByLabel('Data de nascimento').fill(ADULT_BIRTH_DATE);
  await page.keyboard.press('Enter');
  await expectStep(page, TITLES.contact);

  await typeInto(page, page.getByLabel('Seu e-mail'), email);
  await page.keyboard.press('Enter');
  await expectStep(page, TITLES.otp);

  await typeInto(page, page.getByLabel('Código de 6 dígitos'), await lastOtp(email));
  await page.keyboard.press('Enter');
  await expectStep(page, TITLES.password);

  await typeInto(page, page.getByLabel('Senha', { exact: true }), PASSWORD);
  await typeInto(page, page.getByLabel('Confirme a senha'), PASSWORD);

  // Esc closes a document without accepting it and focus returns to its link.
  const documents = page.getByRole('list', { name: 'Documentos para aceitar' });
  await tabTo(page, documents.getByRole('button', { name: DOCUMENT_TITLES[0] }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: DOCUMENT_TITLES[0] })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: DOCUMENT_TITLES[0] })).toBeHidden();
  await expect(documents.getByRole('button', { name: DOCUMENT_TITLES[0] })).toBeFocused();

  for (const title of DOCUMENT_TITLES) {
    await tabTo(page, documents.getByRole('button', { name: title }));
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: title });
    await expect(dialog).toBeVisible();
    await tabTo(page, dialog.getByRole('button', { name: /^Aceitar/ }));
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
  }
  await tabTo(page, page.getByRole('button', { name: 'Salvar senha' }));
  await page.keyboard.press('Enter');
  await expectStep(page, TITLES.requiredData);

  await typeInto(page, page.getByLabel('Nome de exibição'), 'Ana Teste');
  await tabTo(page, page.getByLabel('Estado'));
  await page.getByLabel('Estado').selectOption('PE');
  await typeInto(page, page.getByRole('combobox', { name: 'Município' }), 'Recife');
  await page.getByRole('option', { name: 'Recife', exact: true }).click();
  const intent = page.getByRole('group', { name: 'O que você procura no EventMatch?' }).getByRole('checkbox').first();
  await tabTo(page, intent);
  await page.keyboard.press('Space');
  await expect(intent).toBeChecked();
  await tabTo(page, page.getByRole('button', { name: 'Salvar e continuar' }));
  await page.keyboard.press('Enter');
  await expectStep(page, TITLES.interests);

  const chips = page.getByRole('group', { name: 'Interesses' }).getByRole('checkbox');
  for (let index = 0; index < 3; index += 1) {
    await tabTo(page, chips.nth(index));
    await page.keyboard.press('Space');
    await expect(chips.nth(index)).toBeChecked();
  }
  await tabTo(page, page.getByRole('button', { name: 'Revisar cadastro' }));
  await page.keyboard.press('Enter');
  await expectStep(page, TITLES.review);

  await typeInto(page, page.getByLabel('Confirme sua data de nascimento'), '');
  await page.getByLabel('Confirme sua data de nascimento').fill(ADULT_BIRTH_DATE);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/cadastro\/concluido$/);
});
