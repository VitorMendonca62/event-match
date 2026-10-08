/** @format */

import { registerAccount, signIn } from './support/auth';
import { openProfile } from './support/profile';
import type { Page } from '@playwright/test';
import {
  expect,
  expectNoHorizontalScroll,
  expectNoSeriousA11yViolations,
  test,
} from './support/test';

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
  await page.getByRole('combobox', { name: 'Pronomes' }).click();
  await page.getByRole('option', { name: 'Ela/dela' }).click();
  await page.getByRole('textbox', { name: 'Profissão' }).fill('Produtora cultural');
  const languageSearch = page.getByRole('searchbox', { name: 'Buscar idioma' });
  await languageSearch.fill('Libras');
  await page.getByRole('button', { name: 'Libras' }).click();
  await expect(languageSearch).toBeFocused();
  await languageSearch.fill('Português');
  await page.getByRole('button', { name: 'Português' }).click();
  await expect(languageSearch).toBeFocused();
  await page.getByText('Compartilhar pronomes futuramente?', { exact: true }).click();
  await page.getByText('Compartilhar profissão futuramente?', { exact: true }).click();
  await page.getByText('Compartilhar idiomas futuramente?', { exact: true }).click();
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
    pronounSelection: 'ela_dela',
    profession: 'Produtora cultural',
    languageCodes: ['bzs', 'pt'],
    pronounsVisibility: 'authenticated',
    professionVisibility: 'authenticated',
    languagesVisibility: 'authenticated',
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
  await expect(page.getByText('Ela/dela')).toBeVisible();
  await expect(page.getByText('Produtora cultural')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Idiomas' })).toContainText('Libras');
  await expect(page.getByRole('list', { name: 'Idiomas' })).toContainText('Português');
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

test('perfil: preferências de atividades com limite, privacidade e prévia', async ({ page }) => {
  const email = await registerAccount(page, 'perfil-preferencias');
  await page.goto('/entrar');
  await signIn(page, email);
  await expect(page).toHaveURL(/\/inicio$/);
  await page.goto('/perfil');
  const group = page.getByRole('group', { name: /Preferências de atividades/ });
  await expect(group).toBeVisible();
  const visibility = page.getByRole('switch', { name: 'Compartilhar preferências futuramente?' });
  await expect(visibility).not.toBeChecked();
  const labels = ['Grupo pequeno', 'Ao ar livre', 'Ambiente tranquilo', 'Conversa e socialização', 'Experiência cultural'];
  for (const label of labels) {
    const option = group.getByRole('checkbox', { name: label, exact: true });
    await option.focus();
    await option.press('Space');
    await expect(option).toBeChecked();
  }
  await expect(group).toContainText('5/5');
  await expect(page.getByText('Você escolheu as cinco preferências possíveis', { exact: false })).toBeVisible();
  const blocked = group.getByRole('checkbox', { name: 'Grupo médio', exact: true });
  await expect(blocked).toHaveAttribute('aria-disabled', 'true');
  await blocked.focus();
  await blocked.press('Space');
  await expect(blocked).not.toBeChecked();
  await expectNoSeriousA11yViolations(page);
  await expectNoHorizontalScroll(page);
  const viewport = page.viewportSize();
  const capture = viewport?.width === 1440 || viewport?.width === 390 ? (viewport.width === 390 ? 'mobile' : 'desktop') : null;
  // Impeccable evidence: the limit state is the section's most demanding render.
  if (capture)
    await page.getByRole('region', { name: 'Como você gosta dos encontros' })
      .screenshot({ path: `.impeccable/review/perfil-preferencias-${capture}.png` });

  await page.getByText('Compartilhar preferências futuramente?', { exact: true }).click();
  const update = page.waitForRequest((request) => request.url().endsWith('/api/profile') && request.method() === 'PUT');
  await page.getByRole('button', { name: 'Salvar perfil' }).click();
  await expect(page.getByRole('status')).toContainText('Perfil salvo');
  const sent = (await update).postDataJSON() as { activityPreferenceCodes: string[]; activityPreferencesVisibility: string };
  expect([...sent.activityPreferenceCodes].sort()).toEqual(['conversation_and_socializing', 'cultural_experience', 'outdoor', 'quiet_setting', 'small_group']);
  expect(sent.activityPreferencesVisibility).toBe('authenticated');

  await page.goto('/perfil/previa');
  const previewList = page.getByRole('list', { name: 'Preferências de atividades' });
  await expect(previewList.getByRole('listitem')).toHaveText(['Ao ar livre', 'Ambiente tranquilo', 'Grupo pequeno', 'Experiência cultural', 'Conversa e socialização']);
  if (capture) await page.screenshot({ path: `.impeccable/review/perfil-previa-preferencias-${capture}.png`, fullPage: true });

  await page.goto('/perfil');
  if (capture === 'desktop') {
    // 200% zoom of a 1280×800 window = 640×400 CSS px (same convention as test 14b).
    await page.setViewportSize({ width: 640, height: 400 });
    await expectNoHorizontalScroll(page);
    await page.getByRole('region', { name: 'Como você gosta dos encontros' })
      .screenshot({ path: '.impeccable/review/perfil-preferencias-zoom200.png' });
  }
  const reloaded = page.getByRole('group', { name: /Preferências de atividades/ });
  const removed = reloaded.getByRole('checkbox', { name: 'Grupo pequeno', exact: true });
  await removed.focus();
  await removed.press('Space');
  await expect(removed).not.toBeChecked();
  await expect(reloaded.getByRole('checkbox', { name: 'Grupo médio', exact: true })).not.toHaveAttribute('aria-disabled', 'true');
  await page.getByText('Compartilhar preferências futuramente?', { exact: true }).click();
  await page.getByRole('button', { name: 'Salvar perfil' }).click();
  await expect(page.getByRole('status')).toContainText('Perfil salvo');
  await page.goto('/perfil/previa');
  await expect(page.getByRole('list', { name: 'Preferências de atividades' })).toHaveCount(0);
});

test('perfil: disponibilidade e distância são privadas, persistem e são removíveis', async ({ page }, testInfo) => {
  await openProfile(page, 'perfil-disponibilidade');
  const section = page.getByRole('region', { name: 'Quando e até onde você costuma ir' });
  await expect(section).toBeVisible();

  await section.getByRole('checkbox', { name: 'Sexta-feira madrugada 0h–6h' }).check();
  await section.getByRole('button', { name: 'Fins de semana' }).click();
  await expect(section).toContainText('9 períodos marcados');
  const distance = section.getByRole('slider', { name: 'Até onde você costuma se deslocar?' });
  await distance.scrollIntoViewIfNeeded();
  const distanceBox = await distance.boundingBox();
  if (!distanceBox) throw new Error('Range de distância sem geometria visível.');
  const pointerPoint = {
    x: distanceBox.x + distanceBox.width * 0.8,
    y: distanceBox.y + distanceBox.height / 2,
  };
  if (testInfo.project.name === 'chromium-mobile') {
    await dragWithTouch(
      page,
      { x: distanceBox.x + distanceBox.width * 0.03, y: pointerPoint.y },
      pointerPoint,
    );
  } else
    await page.mouse.click(pointerPoint.x, pointerPoint.y);
  await expect.poll(async () => Number(await distance.inputValue())).toBeGreaterThan(0);
  if (testInfo.project.name !== 'chromium-mobile') {
    const distanceBeforeDrag = Number(await distance.inputValue());
    await page.mouse.move(pointerPoint.x, pointerPoint.y);
    await page.mouse.down();
    await page.mouse.move(distanceBox.x + distanceBox.width * 0.95, pointerPoint.y, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => Number(await distance.inputValue())).toBeGreaterThanOrEqual(distanceBeforeDrag);
  }
  await section.getByRole('button', { name: 'Até 10 km' }).click();
  await expect(distance).toHaveValue('3');
  await expect(section.locator('#preferred-distance-value')).toContainText('Até 10 km');
  await distance.press('Home');
  await distance.press('ArrowRight');
  await distance.press('ArrowRight');
  await expect(section.locator('#preferred-distance-value')).toContainText('Até 5 km');
  await expect(section.getByText('Só você vê estas informações.', { exact: true })).toHaveCount(1);

  const viewport = page.viewportSize();
  const capture = viewport?.width === 1440 || viewport?.width === 390 ? (viewport.width === 390 ? 'mobile' : 'desktop') : null;
  if (capture)
    await section.screenshot({ path: `.impeccable/review/perfil-disponibilidade-${capture}.png` });
  await expectNoSeriousA11yViolations(page);
  await expectNoHorizontalScroll(page);

  const update = page.waitForRequest((request) => request.url().endsWith('/api/profile') && request.method() === 'PUT');
  await page.getByRole('button', { name: 'Salvar perfil' }).click();
  await expect(page.getByRole('status')).toContainText('Perfil salvo');
  expect((await update).postDataJSON()).toMatchObject({
    availabilitySlots: [
      'fri_early_hours',
      'sat_early_hours', 'sat_morning', 'sat_afternoon', 'sat_evening',
      'sun_early_hours', 'sun_morning', 'sun_afternoon', 'sun_evening',
    ],
    preferredDistance: 'up_to_5km',
  });

  await page.goto('/perfil/previa');
  await expect(page.getByText('Quando e até onde você costuma ir', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Até 5 km', { exact: true })).toHaveCount(0);

  await page.goto('/perfil');
  await expect(section.getByRole('checkbox', { name: 'Sexta-feira madrugada 0h–6h' })).toBeChecked();
  await expect(section.getByRole('slider', { name: 'Até onde você costuma se deslocar?' })).toHaveValue('2');
  await section.getByRole('button', { name: 'Limpar' }).click();
  await section.getByRole('slider', { name: 'Até onde você costuma se deslocar?' }).press('Home');
  const clearUpdate = page.waitForRequest((request) => request.url().endsWith('/api/profile') && request.method() === 'PUT');
  await page.getByRole('button', { name: 'Salvar perfil' }).click();
  await expect(page.getByRole('status')).toContainText('Perfil salvo');
  expect((await clearUpdate).postDataJSON()).toMatchObject({ availabilitySlots: [], preferredDistance: null });

  if (capture === 'desktop') {
    await page.setViewportSize({ width: 640, height: 400 });
    await expectNoHorizontalScroll(page);
    await section.screenshot({ path: '.impeccable/review/perfil-disponibilidade-zoom200.png' });
  }
});

test('perfil: presença social usa provedores fixos, compartilha futuramente e remove vínculos vazios', async ({ page }) => {
  await openProfile(page, 'perfil-redes-sociais');
  const section = page.getByRole('region', { name: 'Presença social (opcional)' });
  await expect(section).toBeVisible();
  await expect(section).toContainText('O EventMatch não verifica esses perfis');
  await expect(section.getByRole('textbox', { name: 'Instagram — identificador ou link do perfil' })).toBeVisible();
  await expect(section.getByRole('textbox', { name: 'LinkedIn — identificador ou link do perfil' })).toBeVisible();
  await expect(section.getByRole('textbox', { name: 'X — identificador ou link do perfil' })).toBeVisible();
  await expect(section.getByRole('textbox', { name: 'Instagram — identificador ou link do perfil' })).toHaveAttribute('placeholder', '@pessoa ou instagram.com/pessoa');
  await expect(section.getByRole('textbox', { name: 'LinkedIn — identificador ou link do perfil' })).toHaveAttribute('placeholder', '@pessoa ou linkedin.com/in/pessoa');
  await expect(section.getByRole('textbox', { name: 'X — identificador ou link do perfil' })).toHaveAttribute('placeholder', '@pessoa ou x.com/pessoa');
  await expect(section).not.toContainText('Use seu nome de usuário, como @pessoa, ou cole o endereço do perfil.');
  await expect(section).not.toContainText('Somente o identificador normalizado será guardado.');
  await expect(section.getByRole('button', { name: /Adicionar perfil social/ })).toHaveCount(0);
  await expect(section.getByRole('button', { name: /Mover/ })).toHaveCount(0);

  await section.getByRole('textbox', { name: 'Instagram — identificador ou link do perfil' }).fill('https://www.instagram.com/Ana.Exemplo');
  await section.getByRole('textbox', { name: 'LinkedIn — identificador ou link do perfil' }).fill('pessoa-exemplo');
  await section.getByText('Compartilhar redes sociais futuramente?', { exact: true }).click();
  await expect(section).toContainText('Ative para mostrar a pessoas autenticadas quando esse recurso estiver disponível.');
  const viewport = page.viewportSize();
  if (viewport?.width === 1440 || viewport?.width === 390)
    await section.screenshot({ path: `.impeccable/review/perfil-redes-sociais-${viewport.width === 390 ? 'mobile' : 'desktop'}.png` });
  await expectNoSeriousA11yViolations(page);
  await expectNoHorizontalScroll(page);

  const update = page.waitForRequest((request) => request.url().endsWith('/api/profile') && request.method() === 'PUT');
  await page.getByRole('button', { name: 'Salvar perfil' }).click();
  await expect(page.getByRole('status')).toContainText('Perfil salvo');
  expect((await update).postDataJSON()).toMatchObject({
    socialLinks: [
      { provider: 'instagram', identifierOrUrl: 'https://www.instagram.com/Ana.Exemplo', position: 1, visibility: 'authenticated' },
      { provider: 'linkedin', identifierOrUrl: 'pessoa-exemplo', position: 2, visibility: 'authenticated' },
    ],
  });

  await page.goto('/perfil/previa');
  await expect(page.getByRole('heading', { name: 'Presença social' })).toBeVisible();
  await expect(page.getByText('Instagram', { exact: true })).toBeVisible();
  await expect(page.getByText('LinkedIn', { exact: true })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Instagram' }).getByRole('link', { name: 'Abrir perfil' })).toHaveAttribute('href', 'https://www.instagram.com/ana.exemplo');

  await page.goto('/perfil');
  const reloaded = page.getByRole('region', { name: 'Presença social (opcional)' });
  await reloaded.getByRole('textbox', { name: 'Instagram — identificador ou link do perfil' }).fill('');
  const removeUpdate = page.waitForRequest((request) => request.url().endsWith('/api/profile') && request.method() === 'PUT');
  await page.getByRole('button', { name: 'Salvar perfil' }).click();
  await expect(page.getByRole('status')).toContainText('Perfil salvo');
  expect((await removeUpdate).postDataJSON()).toMatchObject({ socialLinks: [{ provider: 'linkedin', position: 2, visibility: 'authenticated' }] });
  await page.goto('/perfil/previa');
  await expect(page.getByRole('heading', { name: 'Presença social' })).toBeVisible();
  await expect(page.getByText('Instagram', { exact: true })).toHaveCount(0);
  await expect(page.getByText('LinkedIn', { exact: true })).toBeVisible();
});

test('perfil: combobox de pronomes funciona integralmente por teclado', async ({ page }) => {
  const email = await registerAccount(page, 'perfil-pronomes-teclado');
  await page.goto('/entrar');
  await signIn(page, email);
  await expect(page).toHaveURL(/\/inicio$/);
  await page.goto('/perfil');

  const pronouns = page.getByRole('combobox', { name: 'Pronomes' });
  await pronouns.focus();
  await pronouns.press('ArrowDown');
  await expect(pronouns).toHaveAttribute('aria-expanded', 'true');
  await expect(pronouns).toHaveAttribute('aria-activedescendant', /option-1$/);
  await pronouns.press('Enter');
  await expect(pronouns).toContainText('Ela/dela');
  await expect(pronouns).toBeFocused();

  await pronouns.press('Enter');
  await pronouns.press('End');
  await expect(pronouns).toHaveAttribute('aria-activedescendant', /option-5$/);
  await pronouns.press('Escape');
  await expect(pronouns).toHaveAttribute('aria-expanded', 'false');
  await expect(pronouns).toContainText('Ela/dela');

  await pronouns.press('Space');
  await pronouns.press('Home');
  await pronouns.press('ArrowUp');
  await expect(pronouns).toHaveAttribute('aria-activedescendant', /option-5$/);
  await pronouns.press('ArrowDown');
  await expect(pronouns).toHaveAttribute('aria-activedescendant', /option-0$/);
  await pronouns.press('Space');
  await expect(pronouns).toContainText('Não informado');
  await expect(pronouns).toBeFocused();

  const update = page.waitForRequest(
    (request) => request.url().endsWith('/api/profile') && request.method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Salvar perfil' }).click();
  expect((await update).postDataJSON()).toMatchObject({
    pronounSelection: null,
    customPronouns: null,
    pronounsVisibility: 'private',
  });
  await expect(page.getByRole('status')).toContainText('Perfil salvo');

  const sharePronouns = page.getByRole('switch', { name: 'Compartilhar pronomes futuramente?' });
  await page.getByText('Compartilhar pronomes futuramente?', { exact: true }).click();
  await expect(sharePronouns).toBeChecked();
  await pronouns.focus();
  await pronouns.press('Space');
  await pronouns.press('Home');
  await pronouns.press('ArrowDown');
  await pronouns.press('Space');
  await expect(pronouns).toContainText('Ela/dela');
  await expect(sharePronouns).toBeChecked();
  await pronouns.press('Space');
  await pronouns.press('End');
  await pronouns.press('Space');
  await expect(sharePronouns).toBeDisabled();
  await expect(sharePronouns).not.toBeChecked();
  await pronouns.press('Space');
  await pronouns.press('Home');
  await pronouns.press('ArrowDown');
  await pronouns.press('Space');
  await expect(pronouns).toContainText('Ela/dela');
  await expect(sharePronouns).toBeEnabled();
  await expect(sharePronouns).not.toBeChecked();

  await pronouns.press('Space');
  await pronouns.press('End');
  await pronouns.press('ArrowUp');
  await pronouns.press('Space');
  await expect(pronouns).toContainText('Outro');
  await page.getByRole('button', { name: 'Salvar perfil' }).click();
  await expect(page.getByText('Informe seus pronomes.', { exact: true })).toHaveCount(1);
  await expect(page.getByRole('textbox', { name: 'Como devemos escrever?' })).toHaveAccessibleDescription('Informe seus pronomes.');

  await pronouns.focus();
  await pronouns.press('Space');
  await pronouns.press('End');
  await pronouns.press('Space');
  await expect(pronouns).toContainText('Prefiro não informar');
  await expect(
    page.getByRole('switch', { name: 'Compartilhar pronomes futuramente?' }),
  ).toBeDisabled();

  const languageSearch = page.getByRole('searchbox', { name: 'Buscar idioma' });
  for (const label of ['Português', 'Inglês', 'Espanhol', 'Libras', 'Francês']) {
    await languageSearch.fill(label);
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(languageSearch).toBeFocused();
  }
  await expect(page.getByText('5/5', { exact: true })).toBeVisible();
  await expect(page.getByText('Limite de cinco idiomas atingido.')).toBeVisible();

  const preferNotToSayUpdate = page.waitForRequest(
    (request) => request.url().endsWith('/api/profile') && request.method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Salvar perfil' }).click();
  expect((await preferNotToSayUpdate).postDataJSON()).toMatchObject({
    pronounSelection: 'prefer_not_to_say',
    customPronouns: null,
    pronounsVisibility: 'private',
    languageCodes: ['pt', 'en', 'es', 'bzs', 'fr'],
  });
  await expect(page.getByRole('status')).toContainText('Perfil salvo');
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
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({ data: { reason: 'inactive_language' }, message: 'Unprocessable.', statusCode: 422 }),
    }),
  );
  await page.getByRole('button', { name: 'Salvar perfil' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Revise os campos indicados' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Idiomas' })).toHaveAccessibleDescription(
    /não está mais disponível para novas seleções/,
  );
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

  await page.getByLabel('Estado').selectOption('PE');
  await page.getByRole('combobox', { name: 'Município' }).fill('Recife');
  await page.getByRole('option', { name: 'Recife', exact: true }).click();
  await page.getByRole('button', { name: 'Ver prévia' }).click();
  const saveDialog = page.getByRole('alertdialog', {
    name: 'Você tem alterações não salvas',
  });
  const update = page.waitForRequest(
    (request) => request.url().endsWith('/api/profile') && request.method() === 'PUT',
  );
  await saveDialog.getByRole('button', { name: 'Salvar e ver prévia' }).click();
  expect((await update).postDataJSON()).toMatchObject({ ufCode: 'PE', municipalityCode: '2611606' });
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

  await page.getByLabel('Estado').selectOption('PE');
  await page.getByRole('combobox', { name: 'Município' }).fill('Recife');
  await page.getByRole('option', { name: 'Recife', exact: true }).click();
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
