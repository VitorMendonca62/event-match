import type { Locator, Page } from '@playwright/test';

/** Moves focus with Tab only, up to a bounded number of presses. */
export async function tabTo(page: Page, target: Locator, max = 40): Promise<void> {
  for (let press = 0; press < max; press += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('target was not reachable with Tab');
}

export async function typeInto(page: Page, field: Locator, value: string): Promise<void> {
  await tabTo(page, field);
  await page.keyboard.type(value);
}
