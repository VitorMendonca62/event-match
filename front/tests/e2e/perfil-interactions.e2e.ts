/** @format */

import { expect, test } from './support/test';
import { interceptFakeMediaUpload, openProfile, selectImage } from './support/profile';
import type { Locator, Page } from '@playwright/test';

type Point = Readonly<{ x: number; y: number }>;

async function dragWithTouch(page: Page, from: Point, to: Point): Promise<void> {
  const session = await page.context().newCDPSession(page);
  const touchPoint = ({ x, y }: Point) => ({ x, y, id: 0, radiusX: 6, radiusY: 6, force: 1 });
  try {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint(from)] });
    for (let step = 1; step <= 5; step += 1) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [touchPoint({
          x: from.x + ((to.x - from.x) * step) / 5,
          y: from.y + ((to.y - from.y) * step) / 5,
        })],
      });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await session.detach();
  }
}

async function drag(page: Page, hasTouch: boolean, from: Point, to: Point): Promise<void> {
  if (hasTouch) {
    await dragWithTouch(page, from, to);
    return;
  }
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
}

const activate = (locator: Locator, hasTouch: boolean) => hasTouch ? locator.tap() : locator.click();

test('perfil: controles do recorte respondem a mouse no desktop e toque real no mobile', async ({
  page,
}, testInfo) => {
  const hasTouch = testInfo.project.name === 'chromium-mobile';
  await openProfile(page, `perfil-controles-${hasTouch ? 'toque' : 'mouse'}`);
  await selectImage(page);

  const dialog = page.getByRole('dialog', { name: 'Editar foto' });
  await expect(dialog).toBeVisible();
  const horizontal = dialog.getByRole('slider', { name: 'Posição horizontal do recorte' });
  const vertical = dialog.getByRole('slider', { name: 'Posição vertical do recorte' });
  const zoom = dialog.getByRole('slider', { name: 'Ampliação do recorte' });

  async function clickSlider(slider: typeof horizontal, fraction: number) {
    const box = await slider.boundingBox();
    if (!box) throw new Error('Slider sem geometria visível.');
    const point = { x: box.x + box.width * fraction, y: box.y + box.height / 2 };
    if (hasTouch) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
  }
  await clickSlider(horizontal, 0.8);
  await clickSlider(vertical, 0.2);
  await clickSlider(zoom, 0.65);
  expect(Number(await horizontal.inputValue())).toBeGreaterThan(65);
  expect(Number(await vertical.inputValue())).toBeLessThan(35);
  expect(Number(await zoom.inputValue())).toBeGreaterThan(2);

  const horizontalBefore = Number(await horizontal.inputValue());
  await activate(dialog.getByRole('button', { name: 'Diminuir horizontal' }), hasTouch);
  expect(Number(await horizontal.inputValue())).toBeLessThan(horizontalBefore);
  await activate(dialog.getByRole('button', { name: 'Aumentar horizontal' }), hasTouch);
  expect(Number(await horizontal.inputValue())).toBe(horizontalBefore);

  const verticalBefore = Number(await vertical.inputValue());
  await activate(dialog.getByRole('button', { name: 'Aumentar vertical' }), hasTouch);
  expect(Number(await vertical.inputValue())).toBeGreaterThan(verticalBefore);
  await activate(dialog.getByRole('button', { name: 'Diminuir vertical' }), hasTouch);
  expect(Number(await vertical.inputValue())).toBe(verticalBefore);

  const zoomBefore = Number(await zoom.inputValue());
  await activate(dialog.getByRole('button', { name: 'Diminuir ampliação' }), hasTouch);
  expect(Number(await zoom.inputValue())).toBeLessThan(zoomBefore);
  await activate(dialog.getByRole('button', { name: 'Aumentar ampliação' }), hasTouch);
  expect(Number(await zoom.inputValue())).toBeCloseTo(zoomBefore, 1);

  await activate(dialog.getByRole('button', { name: 'Redefinir recorte' }), hasTouch);
  await activate(dialog.getByRole('button', { name: 'Aumentar ampliação' }), hasTouch);
  await activate(dialog.getByRole('button', { name: 'Aumentar ampliação' }), hasTouch);
  const cropFrame = dialog.getByRole('group', { name: /Área quadrada de recorte/ });
  const frameBeforeMove = await cropFrame.boundingBox();
  if (!frameBeforeMove) throw new Error('Área de recorte sem geometria visível.');
  await drag(
    page,
    hasTouch,
    { x: frameBeforeMove.x + frameBeforeMove.width / 2, y: frameBeforeMove.y + frameBeforeMove.height / 2 },
    { x: frameBeforeMove.x + frameBeforeMove.width / 2 - 35, y: frameBeforeMove.y + frameBeforeMove.height / 2 - 20 },
  );
  const frameAfterMove = await cropFrame.boundingBox();
  expect(frameAfterMove?.x).toBeLessThan(frameBeforeMove.x - 10);

  const resizeHandle = dialog.getByRole('button', { name: 'Redimensionar área de recorte' });
  const handle = await resizeHandle.boundingBox();
  if (!handle || !frameAfterMove) throw new Error('Alça de recorte sem geometria visível.');
  expect(handle.width).toBeGreaterThanOrEqual(44);
  expect(handle.height).toBeGreaterThanOrEqual(44);
  await drag(
    page,
    hasTouch,
    { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 },
    { x: handle.x - 35, y: handle.y - 35 },
  );
  const frameAfterResize = await cropFrame.boundingBox();
  expect(frameAfterResize?.width).toBeLessThan(frameAfterMove.width);
});

test('perfil: editor de foto é modal, fecha por Esc e cancelar e restaura o foco', async ({
  page,
}) => {
  await openProfile(page, 'perfil-modal-foto');
  const input = page.locator('input[type="file"]');
  await selectImage(page);
  const dialog = page.getByRole('dialog', { name: 'Editar foto' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect.poll(() => input.evaluate((element) => element === document.activeElement)).toBe(true);

  await selectImage(page, 'perfil-novamente.png');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => input.evaluate((element) => element === document.activeElement)).toBe(true);
});

test('perfil: rejeita tipo, tamanho e conteúdo de imagem inválidos', async ({ page }) => {
  await openProfile(page, 'perfil-arquivos-invalidos');
  const input = page.locator('input[type="file"]');

  await input.setInputFiles({ name: 'perfil.txt', mimeType: 'text/plain', buffer: Buffer.from('não é imagem') });
  await expect(page.getByRole('status')).toContainText('JPEG, PNG ou WebP estático de até 5 MiB');

  await input.setInputFiles({
    name: 'grande.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(5_242_881),
  });
  await expect(page.getByRole('status')).toContainText('JPEG, PNG ou WebP estático de até 5 MiB');

  await input.setInputFiles({ name: 'corrompida.png', mimeType: 'image/png', buffer: Buffer.from('PNG inválido') });
  await expect(page.getByRole('status')).toContainText('Não foi possível abrir essa imagem');

  const smallImage = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 319;
    canvas.height = 400;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D indisponível.');
    context.fillStyle = 'rgb(225 29 72)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await input.setInputFiles({
    name: 'pequena.png',
    mimeType: 'image/png',
    buffer: Buffer.from(smallImage, 'base64'),
  });
  await expect(page.getByRole('status')).toContainText('pelo menos 320 × 320 px');
  await expect(page.getByRole('dialog', { name: 'Editar foto' })).toHaveCount(0);
});

test('perfil: adiciona, substitui e remove a foto com persistência após reload', async ({ page }) => {
  await openProfile(page, 'perfil-ciclo-foto');
  await interceptFakeMediaUpload(page);

  await selectImage(page, 'primeira.png');
  await page.getByRole('button', { name: 'Usar este recorte' }).click();
  await expect(page.getByRole('status')).toContainText('Foto principal atualizada');
  const currentPhoto = page.getByRole('img', { name: 'Foto principal atual' });
  await expect(currentPhoto).toBeVisible();
  const firstSource = await currentPhoto.getAttribute('src');
  await page.reload();
  await expect(currentPhoto).toHaveAttribute('src', firstSource ?? '');

  await selectImage(page, 'segunda.png', ['rgb(34 197 94)', 'rgb(59 130 246)']);
  await page.getByRole('button', { name: 'Usar este recorte' }).click();
  await expect(page.getByRole('status')).toContainText('Foto principal atualizada');
  const secondSource = await currentPhoto.getAttribute('src');
  expect(secondSource).not.toBe(firstSource);
  await page.reload();
  await expect(currentPhoto).toHaveAttribute('src', secondSource ?? '');

  await page.getByRole('button', { name: 'Remover foto' }).click();
  await page.getByRole('button', { name: 'Sim, remover' }).click();
  await expect(page.getByRole('status')).toContainText('Foto removida');
  await expect(currentPhoto).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Nenhuma foto', { exact: true })).toBeVisible();
});

test('perfil: salvar leva a página ao topo', async ({ page }) => {
  await openProfile(page, 'perfil-scroll-topo');
  await page.getByLabel('Estado').selectOption('PE');
  await page.getByRole('combobox', { name: 'Município' }).fill('Recife');
  await page.getByRole('option', { name: 'Recife', exact: true }).click();
  const save = page.getByRole('button', { name: 'Salvar perfil' });
  await save.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await save.click();
  await expect(page.getByRole('status')).toContainText('Perfil salvo');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});
