import { expect, type Page } from '@playwright/test';

import { registerAccount, signIn } from './auth';

export async function openProfile(page: Page, suffix: string) {
  const email = await registerAccount(page, suffix);
  await page.goto('/entrar');
  await signIn(page, email);
  await expect(page).toHaveURL(/\/inicio$/);
  await page.goto('/perfil');
}

async function imageFixture(page: Page, first = 'rgb(225 29 72)', second = 'rgb(245 158 11)') {
  const base64 = await page.evaluate(([left, right]) => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 400;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D indisponível.');
    context.fillStyle = left;
    context.fillRect(0, 0, 400, 400);
    context.fillStyle = right;
    context.fillRect(400, 0, 400, 400);
    return canvas.toDataURL('image/png').split(',')[1];
  }, [first, second]);
  return Buffer.from(base64, 'base64');
}

export async function selectImage(page: Page, name = 'perfil.png', colors?: [string, string]) {
  await page.locator('input[type="file"]').setInputFiles({
    name,
    mimeType: 'image/png',
    buffer: await imageFixture(page, colors?.[0], colors?.[1]),
  });
}

export async function interceptFakeMediaUpload(page: Page) {
  await page.route('https://api.cloudinary.com/v1_1/fixture/image/upload', async (route) => {
    const multipart = route.request().postDataBuffer()?.toString('latin1') ?? '';
    const publicId = multipart
      .split('name="public_id"')[1]
      ?.split('\r\n\r\n')[1]
      ?.split('\r\n')[0];
    if (!publicId) throw new Error('public_id não encontrado no upload multipart.');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        asset_id: `asset-${Date.now()}`,
        public_id: publicId,
        version: 1,
        signature: 'fixture-response-signature',
        format: 'webp',
        bytes: 1024,
        width: 512,
        height: 512,
      }),
    });
  });
}
