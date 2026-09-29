import { expect, type Locator, type Page } from '@playwright/test';

import { lastOtp } from './brevo';

/** Fictional data only (`example.test`, invented birth date and password). */
export const ADULT_BIRTH_DATE = '1990-05-15';
export const MINOR_BIRTH_DATE = new Date(Date.now() - 10 * 365.25 * 86_400_000).toISOString().slice(0, 10);
export const PASSWORD = 'Cafe-com-pao-na-praca-2031!';
export const DOCUMENT_TITLES = ['Termos de Uso', 'Política de Privacidade', 'Regras de Convivência'] as const;

export const TITLES = {
  birth: 'Quando você nasceu?',
  contact: 'Como confirmamos que é você?',
  otp: 'Digite o código',
  password: 'Crie sua senha',
  requiredData: 'Conte um pouco sobre você',
  interests: 'Do que você gosta?',
  review: 'Tudo pronto para começar',
} as const;

export function uniqueEmail(label: string): string {
  return `${label}-${crypto.randomUUID().slice(0, 8)}@example.test`;
}

export function stepHeading(page: Page, title: string): Locator {
  return page.getByRole('heading', { level: 1, name: title });
}

/** A freshly loaded page shows the step title; focus moves only on transitions (see `expectStep`). */
export async function expectLanding(page: Page, title: string): Promise<void> {
  await expect(stepHeading(page, title)).toBeVisible();
}

/** Every transition moves focus to the step title (a11y: focus management). */
export async function expectStep(page: Page, title: string): Promise<void> {
  const heading = stepHeading(page, title);
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
}

export async function fillBirth(page: Page, date = ADULT_BIRTH_DATE): Promise<void> {
  await page.getByLabel('Data de nascimento').fill(date);
  await page.getByRole('button', { name: 'Continuar' }).click();
}

export async function fillEmail(page: Page, email: string): Promise<void> {
  await page.getByLabel('Seu e-mail').fill(email);
  await page.getByRole('button', { name: 'Enviar código' }).click();
}

export async function fillOtp(page: Page, code: string): Promise<void> {
  await page.getByLabel('Código de 6 dígitos').fill(code);
  await page.getByRole('button', { name: 'Confirmar e-mail' }).click();
}

export async function confirmOtp(page: Page, email: string): Promise<void> {
  await fillOtp(page, await lastOtp(email));
}

/** Opens one document from the list and accepts it in the modal. */
export async function acceptDocument(page: Page, title: string): Promise<void> {
  const documents = page.getByRole('list', { name: 'Documentos para aceitar' });
  await documents.getByRole('button', { name: title }).click();
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /^Aceitar/ }).click();
  await expect(dialog).toBeHidden();
}

export async function acceptAllDocuments(page: Page): Promise<void> {
  for (const title of DOCUMENT_TITLES) await acceptDocument(page, title);
}

export async function fillPassword(page: Page, options: { accept?: boolean } = {}): Promise<void> {
  await page.getByLabel('Senha', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirme a senha').fill(PASSWORD);
  if (options.accept ?? true) await acceptAllDocuments(page);
  await page.getByRole('button', { name: 'Salvar senha' }).click();
}

export async function fillRequiredData(page: Page): Promise<void> {
  await page.getByLabel('Nome de exibição').fill('Ana Teste');
  await page.getByLabel('Bairro ou cidade').fill('Boa Vista, Recife');
  await page
    .getByRole('group', { name: 'O que você procura no EventMatch?' })
    .getByRole('checkbox')
    .first()
    .check({ force: true });
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
}

export async function chooseInterests(page: Page, count = 3): Promise<void> {
  const boxes = page.getByRole('group', { name: 'Interesses' }).getByRole('checkbox');
  await expect(boxes.first()).toBeVisible();
  for (let index = 0; index < count; index += 1) await boxes.nth(index).check({ force: true });
}

export async function goToReview(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Revisar cadastro' }).click();
}

export async function finish(page: Page, date = ADULT_BIRTH_DATE): Promise<void> {
  await page.getByLabel('Confirme sua data de nascimento').fill(date);
  await page.getByRole('button', { name: 'Concluir cadastro' }).click();
}

/** Drives the flow from `/cadastro` up to (and landing on) the requested step. */
export async function advanceTo(
  page: Page,
  email: string,
  target: 'otp' | 'password' | 'requiredData' | 'interests' | 'review',
): Promise<void> {
  await page.goto('/cadastro');
  await expectLanding(page, TITLES.birth);
  await fillBirth(page);
  await expectStep(page, TITLES.contact);
  await fillEmail(page, email);
  await expectStep(page, TITLES.otp);
  if (target === 'otp') return;
  await confirmOtp(page, email);
  await expectStep(page, TITLES.password);
  if (target === 'password') return;
  await fillPassword(page);
  await expectStep(page, TITLES.requiredData);
  if (target === 'requiredData') return;
  await fillRequiredData(page);
  await expectStep(page, TITLES.interests);
  if (target === 'interests') return;
  await chooseInterests(page);
  await goToReview(page);
  await expectStep(page, TITLES.review);
}
