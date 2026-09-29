import type { Page } from '@playwright/test';

import {
  acceptDocument,
  chooseInterests,
  confirmOtp,
  DOCUMENT_TITLES,
  expectLanding,
  expectStep,
  fillBirth,
  fillEmail,
  fillRequiredData,
  goToReview,
  PASSWORD,
  TITLES,
  uniqueEmail,
} from './flow';
import { expect, expectNoHorizontalScroll, expectNoSeriousA11yViolations } from './test';

export type ScreenCheck = (page: Page) => Promise<void>;

/** Axe (serious/critical) plus no horizontal scroll. */
export const fullCheck: ScreenCheck = async (page) => {
  await expectNoSeriousA11yViolations(page);
  await expectNoHorizontalScroll(page);
};

export const overflowCheck: ScreenCheck = expectNoHorizontalScroll;

/** Walks every step, running `check` on each screen and on the document/refusal dialogs. */
export async function walkRegistration(page: Page, check: ScreenCheck): Promise<void> {
  const email = uniqueEmail('a11y');
  await page.goto('/cadastro');
  await expectLanding(page, TITLES.birth);
  await check(page);

  await fillBirth(page);
  await expectStep(page, TITLES.contact);
  await check(page);

  await fillEmail(page, email);
  await expectStep(page, TITLES.otp);
  await check(page);

  await confirmOtp(page, email);
  await expectStep(page, TITLES.password);
  // The documents arrive through `router.refresh()`; check the screen once they are in place.
  await expect(page.getByRole('list', { name: 'Documentos para aceitar' })).toBeVisible();
  await check(page);

  const first = DOCUMENT_TITLES[0];
  await page.getByRole('list', { name: 'Documentos para aceitar' }).getByRole('button', { name: first }).click();
  await expect(page.getByRole('dialog', { name: first })).toBeVisible();
  await check(page);
  await page.getByRole('dialog', { name: first }).getByRole('button', { name: /^Recusar/ }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await check(page);
  await page.getByRole('alertdialog').getByRole('button', { name: 'Rever documentos' }).click();
  // "Rever documentos" reopens the same document, so it is accepted right there.
  const reopened = page.getByRole('dialog', { name: first });
  await expect(reopened).toBeVisible();
  await reopened.getByRole('button', { name: /^Aceitar/ }).click();
  await expect(reopened).toBeHidden();
  for (const title of DOCUMENT_TITLES.slice(1)) await acceptDocument(page, title);
  await page.getByLabel('Senha', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirme a senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Salvar senha' }).click();
  await expectStep(page, TITLES.requiredData);
  await check(page);

  await fillRequiredData(page);
  await expectStep(page, TITLES.interests);
  await chooseInterests(page, 3);
  await check(page);

  await goToReview(page);
  await expectStep(page, TITLES.review);
  await check(page);
}
