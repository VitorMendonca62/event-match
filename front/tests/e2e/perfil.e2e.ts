/** @format */

import { registerAccount, signIn } from './support/auth';
import {
  expect,
  expectNoHorizontalScroll,
  expectNoSeriousA11yViolations,
  test,
} from './support/test';

test('perfil: convite, edição, prévia e adiamento por navegador', async ({
  page,
  context,
}) => {
  const email = await registerAccount(page, 'perfil');
  await page.goto('/entrar');
  await signIn(page, email);
  await expect(page).toHaveURL(/\/inicio$/);
  const viewport = page.viewportSize();
  if (viewport?.width === 1440 || viewport?.width === 390)
    await page.screenshot({
      path: `.impeccable/review/inicio-${viewport.width === 390 ? 'mobile' : 'desktop'}.png`,
      fullPage: true,
    });
  await expectNoSeriousA11yViolations(page);
  await expectNoHorizontalScroll(page);
  await page.getByRole('link', { name: 'Completar perfil' }).click();
  await expect(page).toHaveURL(/\/perfil$/);
  if (viewport?.width === 1440 || viewport?.width === 390)
    await page.screenshot({
      path: `.impeccable/review/perfil-${viewport.width === 390 ? 'mobile' : 'desktop'}.png`,
      fullPage: true,
    });
  await expectNoSeriousA11yViolations(page);
  await expectNoHorizontalScroll(page);
  await page
    .getByRole('textbox', { name: /^Apresentação/ })
    .fill('Gosto de conhecer a cidade em atividades de grupo.');
  const photoVisibility = page.getByRole('switch', {
    name: 'Quem poderá ver a foto futuramente?',
  });
  await expect(photoVisibility).not.toBeChecked();
  const presentationVisibility = page.getByRole('switch', {
    name: 'Quem poderá ver a apresentação futuramente?',
  });
  await page
    .getByText('Quem poderá ver a apresentação futuramente?', { exact: true })
    .click();
  await expect(presentationVisibility).toBeChecked();
  const privateUpdate = page.waitForRequest(
    (request) => request.url().endsWith('/api/profile') && request.method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Salvar perfil' }).click();
  await expect(page.getByRole('status')).toContainText('Perfil salvo');
  expect((await privateUpdate).postDataJSON()).toMatchObject({
    photoVisibility: 'private',
  });
  await page.getByText('Quem poderá ver a foto futuramente?', { exact: true }).click();
  await expect(photoVisibility).toBeChecked();
  const authenticatedUpdate = page.waitForRequest(
    (request) => request.url().endsWith('/api/profile') && request.method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Salvar perfil' }).click();
  await expect(page.getByRole('status')).toContainText('Perfil salvo');
  expect((await authenticatedUpdate).postDataJSON()).toMatchObject({
    photoVisibility: 'authenticated',
  });
  await page.getByRole('textbox', { name: 'Nome de exibição' }).fill('Rascunho não salvo');
  await page.getByRole('button', { name: 'Ver prévia' }).click();
  const previewWarning = page.getByRole('alertdialog', {
    name: 'Você tem alterações não salvas',
  });
  await expect(previewWarning).toContainText('somente as informações que já estão salvas');
  await previewWarning.getByRole('button', { name: 'Ir mesmo assim' }).click();
  await expect(page).toHaveURL(/\/perfil\/previa$/);
  await expect(
    page.getByText('Gosto de conhecer a cidade em atividades de grupo.'),
  ).toBeVisible();
  if (viewport?.width === 1440 || viewport?.width === 390)
    await page.screenshot({
      path: `.impeccable/review/perfil-previa-${viewport.width === 390 ? 'mobile' : 'desktop'}.png`,
      fullPage: true,
    });
  await expectNoSeriousA11yViolations(page);
  await expectNoHorizontalScroll(page);
  await page.goto('/inicio');
  await page.getByRole('button', { name: 'Agora não' }).click();
  await expect(page.getByRole('status')).toContainText('sete dias');
  const cookie = (await context.cookies()).find(
    (item) => item.name === 'eventmatch_profile_invite',
  );
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
  await page.reload();
  await expect(page.getByRole('link', { name: 'Completar perfil' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  const otherEmail = await registerAccount(page, 'perfil-outra-conta');
  await page.goto('/entrar');
  await signIn(page, otherEmail);
  await expect(page.getByRole('link', { name: 'Completar perfil' })).toBeVisible();
});

test('perfil: falha de rede libera a ação e sessão expirada volta ao login', async ({
  page,
}) => {
  const email = await registerAccount(page, 'perfil-rede');
  await page.goto('/entrar');
  await signIn(page, email);
  await expect(page).toHaveURL(/\/inicio$/);
  await page.goto('/perfil');
  await page.route('**/api/profile', (route) => route.abort('connectionfailed'));
  await page.getByRole('button', { name: 'Salvar perfil' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Não foi possível salvar' }),
  ).toContainText('Verifique sua conexão');
  await expect(page.getByRole('button', { name: 'Salvar perfil' })).toBeEnabled();
  await page.unroute('**/api/profile');
  await page.route('**/api/profile', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {},
        message: 'Authentication is required.',
        statusCode: 401,
      }),
    }),
  );
  await page.getByRole('button', { name: 'Salvar perfil' }).click();
  await expect(page).toHaveURL(/\/entrar$/);
});

test('perfil: prévia oferece salvar o rascunho ou descartá-lo', async ({ page }) => {
  const email = await registerAccount(page, 'perfil-previa-rascunho');
  await page.goto('/entrar');
  await signIn(page, email);
  await expect(page).toHaveURL(/\/inicio$/);
  await page.goto('/perfil');

  await page.getByRole('textbox', { name: 'Região aproximada' }).fill('Centro, Recife');
  await page.getByRole('button', { name: 'Ver prévia' }).click();
  const saveDialog = page.getByRole('alertdialog', {
    name: 'Você tem alterações não salvas',
  });
  const update = page.waitForRequest(
    (request) => request.url().endsWith('/api/profile') && request.method() === 'PUT',
  );
  await saveDialog.getByRole('button', { name: 'Salvar e ver prévia' }).click();
  expect((await update).postDataJSON()).toMatchObject({ region: 'Centro, Recife' });
  await expect(page).toHaveURL(/\/perfil\/previa$/);

  await page.goto('/perfil');
  await page.getByRole('textbox', { name: 'Nome de exibição' }).fill('Nome descartado');
  await page.getByRole('button', { name: 'Ver prévia' }).click();
  const discardDialog = page.getByRole('alertdialog', {
    name: 'Você tem alterações não salvas',
  });
  await discardDialog.getByRole('button', { name: 'Ir mesmo assim' }).click();
  await expect(page).toHaveURL(/\/perfil\/previa$/);
  await expect(page.getByText('Nome descartado')).toHaveCount(0);
});

test('perfil: conflito entre abas preserva o rascunho e permite reaplicá-lo', async ({ page, context }) => {
  const email = await registerAccount(page, 'perfil-conflito');
  await page.goto('/entrar');
  await signIn(page, email);
  await expect(page).toHaveURL(/\/inicio$/);
  await page.goto('/perfil');
  const otherPage = await context.newPage();
  await otherPage.goto('/perfil');

  await page.getByRole('textbox', { name: 'Região aproximada' }).fill('Boa Viagem, Recife');
  await page.getByRole('button', { name: 'Salvar perfil' }).click();
  await expect(page.getByRole('status')).toContainText('Perfil salvo');

  const draft = otherPage.getByRole('textbox', { name: 'Nome de exibição' });
  await draft.fill('Rascunho preservado');
  await otherPage.getByRole('button', { name: 'Salvar perfil' }).click();
  const conflict = otherPage.getByRole('status');
  await expect(conflict).toContainText('mudou em outra aba');
  await expect(draft).toHaveValue('Rascunho preservado');
  await conflict.getByRole('button', { name: 'Carregar versão atual' }).click();
  await expect(conflict).toContainText('Seu rascunho foi mantido');
  await expect(draft).toHaveValue('Rascunho preservado');
  await otherPage.getByRole('button', { name: 'Salvar perfil' }).click();
  await expect(otherPage.getByRole('status')).toContainText('Perfil salvo');
  await expect(draft).toHaveValue('Rascunho preservado');
  await otherPage.close();
});

test('perfil: falha do provedor preserva o estado recuperável da foto', async ({
  page,
}) => {
  const email = await registerAccount(page, 'perfil-foto');
  await page.goto('/entrar');
  await signIn(page, email);
  await expect(page).toHaveURL(/\/inicio$/);
  await page.goto('/perfil');
  await page.route('**/api/profile/photo/uploads', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ data: {}, message: 'Request failed.', statusCode: 503 }),
    }),
  );
  await page
    .locator('input[type="file"]')
    .setInputFiles('.impeccable/review/perfil-mobile.png');
  const cropFrame = page.getByRole('group', { name: /Área quadrada de recorte/ });
  await expect(cropFrame).toBeVisible();
  const initialFrame = await cropFrame.boundingBox();
  await page.getByRole('slider', { name: 'Ampliação do recorte' }).fill('1.5');
  const zoomedFrame = await cropFrame.boundingBox();
  expect(zoomedFrame?.width).toBeLessThan(initialFrame?.width ?? 0);
  await page.getByRole('button', { name: 'Usar este recorte' }).click();
  await expect(page.getByRole('status')).toContainText('foto atual foi preservada');
  await expect(page.getByRole('dialog', { name: 'Editar foto' })).toBeHidden();
});

test('perfil: recorte envia a seleção assimétrica como WebP', async ({ page }) => {
  const email = await registerAccount(page, 'perfil-recorte');
  await page.goto('/entrar');
  await signIn(page, email);
  await expect(page).toHaveURL(/\/inicio$/);
  await page.goto('/perfil');
  const uploadId = '0199aef0-7757-7000-8000-000000000001';
  await page.route('**/api/profile/photo/uploads', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          uploadId,
          uploadUrl: 'https://api.cloudinary.com/v1_1/fixture/image/upload',
          cloudName: 'fixture',
          apiKey: 'public',
          publicId: `profiles/${uploadId}`,
          timestamp: 1_700_000_000,
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
          uploadPreset: 'profile-signed',
          signature: 'signed',
        },
      }),
    }),
  );
  let sentWebp = false;
  let webpBase64 = '';
  let uploadDiagnostic = '';
  await page.route('https://api.cloudinary.com/**', (route) => {
    const body = route.request().postDataBuffer();
    const start = body?.indexOf(Buffer.from('RIFF')) ?? -1;
    const end = body?.lastIndexOf(Buffer.from('\r\n--')) ?? -1;
    if (body && start >= 0 && end > start) webpBase64 = body.subarray(start, end).toString('base64');
    uploadDiagnostic = JSON.stringify({ contentType: route.request().headers()['content-type'], length: body?.byteLength ?? 0, riff: start, webp: body?.indexOf(Buffer.from('WEBP')) ?? -1 });
    sentWebp =
      start >= 0 &&
      (body?.byteLength ?? 0) > start + 100 &&
      body?.subarray(start + 8, start + 12).toString() === 'WEBP';
    return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  });
  const fixtureBase64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 400;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D indisponível.');
    context.fillStyle = 'rgb(255 0 0)'; context.fillRect(0, 0, 400, 200);
    context.fillStyle = 'rgb(0 0 255)'; context.fillRect(400, 0, 400, 200);
    context.fillStyle = 'rgb(0 255 0)'; context.fillRect(0, 200, 400, 200);
    context.fillStyle = 'rgb(255 255 0)'; context.fillRect(400, 200, 400, 200);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: 'quadrantes.png', mimeType: 'image/png', buffer: Buffer.from(fixtureBase64, 'base64') });
  await page.getByRole('slider', { name: 'Posição horizontal do recorte' }).fill('100');
  await page.getByRole('slider', { name: 'Posição vertical do recorte' }).fill('100');
  await page.getByRole('slider', { name: 'Ampliação do recorte' }).fill('2');
  const frameStyle = await page.getByRole('group', { name: /Área quadrada de recorte/ }).getAttribute('style');
  expect(frameStyle).toContain('left: 75%');
  expect(frameStyle).toContain('top: 50%');
  expect(frameStyle).toContain('width: 25%');
  await page.getByRole('button', { name: 'Usar este recorte' }).click();
  await expect(page.getByRole('status')).toContainText('foto atual foi preservada');
  await expect(page.getByRole('dialog', { name: 'Editar foto' })).toBeHidden();
  if (!sentWebp) throw new Error(`Upload capturado sem WebP reconhecível: ${uploadDiagnostic}`);
  const decoded = await page.evaluate(async (base64) => {
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const bitmap = await createImageBitmap(new Blob([buffer], { type: 'image/webp' }));
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D indisponível.');
    context.drawImage(bitmap, 0, 0);
    const pixel = Array.from(context.getImageData(bitmap.width / 2, bitmap.height / 2, 1, 1).data);
    bitmap.close(); return { width: canvas.width, height: canvas.height, pixel };
  }, webpBase64);
  expect(decoded).toMatchObject({ width: 1024, height: 1024 });
  expect(decoded.pixel[0]).toBeGreaterThan(220);
  expect(decoded.pixel[1]).toBeGreaterThan(220);
  expect(decoded.pixel[2]).toBeLessThan(40);
});
