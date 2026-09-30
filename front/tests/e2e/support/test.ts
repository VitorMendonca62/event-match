import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test as base } from '@playwright/test';

import { resetLoginAttempts, resetOriginWindow } from './db';

/** Every scenario starts with a clean origin window (the fixture edge gives all browsers one origin). */
export const test = base.extend<{ freshOrigin: void }>({
  freshOrigin: [
    async ({}, use) => {
      await Promise.all([resetOriginWindow(), resetLoginAttempts()]);
      await use();
    },
    { auto: true },
  ],
});

export { expect };

/** Axe with the WCAG A/AA rule sets; only `serious` and `critical` findings fail (SDD-012 §6). */
export async function expectNoSeriousA11yViolations(page: Page): Promise<void> {
  // Contrast is sampled at rest: a button that just became enabled is still in its 200 ms color
  // transition, which axe reads as a low-contrast mix of both states.
  await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished)));
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const serious = violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  expect(
    serious.map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.map((node) => node.target) })),
  ).toEqual([]);
}

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}
