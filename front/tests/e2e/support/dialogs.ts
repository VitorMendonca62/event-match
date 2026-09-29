import { expect, type Locator, type Page } from '@playwright/test';

/** The button named after a document, inside the consent list. */
export function documentButton(page: Page, title: string): Locator {
  return page.getByRole('list', { name: 'Documentos para aceitar' }).getByRole('button', { name: title });
}

/** Native `<dialog>` keeps focus inside while open; the check polls because focus moves after `showModal`. */
export async function expectFocusInside(dialog: Locator): Promise<void> {
  await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
}
