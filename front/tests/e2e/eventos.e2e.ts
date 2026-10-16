import { makeNewestAccountHostEligible } from './support/db';
import { registerAccount, signIn } from './support/auth';
import { expect, expectNoHorizontalScroll, expectNoSeriousA11yViolations, test } from './support/test';

test('eventos: cria, salva, retoma, trata conflito, revisa privacidade e publica', async ({ page }) => {
  const email = await registerAccount(page, 'eventos');
  await page.goto('/entrar');
  await signIn(page, email);
  await expect(page).toHaveURL(/\/inicio$/);
  await makeNewestAccountHostEligible();

  await page.goto('/eventos');
  const viewport = page.viewportSize();
  const capture = viewport?.width === 390 ? 'mobile' : viewport?.width === 1440 ? 'desktop' : undefined;
  if (capture) {
    await page.screenshot({ path: `.impeccable/review/eventos-home-${capture}.png`, fullPage: true });
    await page.screenshot({ path: `.impeccable/review/eventos-home-${capture}-viewport.png` });
  }
  await page.getByRole('link', { name: 'Criar encontro' }).click();
  await expect(page).toHaveURL(/\/eventos\/novo$/);
  if (capture) {
    await page.screenshot({ path: `.impeccable/review/eventos-novo-${capture}.png`, fullPage: true });
    await page.screenshot({ path: `.impeccable/review/eventos-novo-${capture}-viewport.png` });
  }
  await page.getByRole('button', { name: 'Criar rascunho' }).click();
  await expect(page).toHaveURL(/\/eventos\/novo\/[0-9a-f-]+$/i);
  await expect(page.getByRole('heading', { name: /Prepare seu convite/ })).toBeVisible();
  await expect(page.getByText(/ao abrir, o serviço público recebe o município/i)).toBeVisible();
  const eventId = page.url().split('/').at(-1);
  if (!eventId) throw new Error('A rota identificada do evento não contém seu id.');

  await page.getByLabel('Tipo de atividade').selectOption({ label: 'Caminhada' });
  await page.getByLabel('Nome do encontro').fill('Caminhada leve pelo Recife Antigo');
  await page.getByLabel('Sobre o encontro').fill('Uma caminhada informal para conhecer a cidade em grupo. Vamos caminhar em ritmo tranquilo.');
  await page.getByLabel('Estado').selectOption('PE');
  const municipality = page.getByRole('combobox', { name: 'Município' });
  await municipality.fill('Recife');
  await page.getByRole('option', { name: 'Recife', exact: true }).click();
  await page.getByLabel('Categoria de local').selectOption('public_place');
  await page.getByRole('checkbox', { name: 'Confirmo que o encontro não acontecerá em uma residência.' }).check();
  const startsAt = new Date(Date.now() + 3 * 24 * 60 * 60_000);
  const endsAt = new Date(startsAt.getTime() + 90 * 60_000);
  await page.getByLabel('Início (data e hora)').fill(startsAt.toISOString().slice(0, 16));
  await page.getByLabel('Término (opcional)').fill(endsAt.toISOString().slice(0, 16));
  await page.getByLabel('Total de pessoas').fill('8');
  await page.getByRole('radio', { name: /Aprovar cada pedido/ }).check();

  await page.getByRole('button', { name: 'Publicar' }).click();
  const publicationErrors = page.getByRole('alert').filter({ hasText: 'Corrija os campos destacados para publicar.' });
  await expect(publicationErrors).toContainText('Defina a latitude escolhendo um local no mapa ou informando este campo.');
  await expect(publicationErrors).toContainText('Defina a longitude escolhendo um local no mapa ou informando este campo.');
  await expect(page.getByRole('dialog', { name: 'Publicar este encontro?' })).toHaveCount(0);

  await page.getByLabel('Latitude').fill('-8.045');
  await page.getByLabel('Longitude').fill('-34.875');

  const ref = await page.evaluate(() => Object.entries(window.sessionStorage).find(([key]) => key === 'eventmatch:event-draft-reference:v1'));
  expect(ref).toBeDefined();
  const stored = JSON.parse(ref?.[1] ?? '{}') as Record<string, unknown>;
  expect(Object.keys(stored).sort()).toEqual(['eventId', 'touchedAt', 'version']);
  expect(stored.eventId).toBe(eventId);
  expect(JSON.stringify(stored)).not.toContain('-8.045');

  const firstSave = page.waitForResponse((response) => response.url().endsWith(`/api/events/drafts/${eventId}`) && response.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  const firstSaveBody = await (await firstSave).json() as { data: { revision: number } };
  await expect(page.getByRole('status')).toContainText('Rascunho salvo');

  await page.getByRole('navigation', { name: 'Navegação da conta' }).getByRole('link', { name: 'Voltar a encontros' }).click();
  await expect(page).toHaveURL(/\/eventos$/);
  await expect(page.getByRole('link', { name: 'Continuar rascunho' })).toBeVisible();
  await page.getByRole('link', { name: 'Continuar rascunho' }).click();
  await expect(page).toHaveURL(new RegExp(`/eventos/novo/${eventId}$`));
  await expect(page.getByLabel('Nome do encontro')).toHaveValue('Caminhada leve pelo Recife Antigo');

  const remoteUpdate = await page.evaluate(async ({ id, revision }) => {
    const response = await fetch(`/api/events/drafts/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ revision, title: 'Alteração remota em outra aba' }),
    });
    return response.status;
  }, { id: eventId, revision: firstSaveBody.data.revision });
  expect(remoteUpdate).toBe(200);
  await page.getByLabel('Nome do encontro').fill('Edição local preservada no conflito');
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  const conflict = page.getByRole('alert').filter({ hasText: 'Outra alteração foi salva' });
  await expect(conflict).toBeVisible();
  await expect(page.getByLabel('Nome do encontro')).toHaveValue('Edição local preservada no conflito');
  await conflict.getByRole('button', { name: 'Recarregar versão remota' }).click();
  await expect(page.getByLabel('Nome do encontro')).toHaveValue('Alteração remota em outra aba');

  await page.getByLabel('Nome do encontro').fill('Caminhada leve pelo Recife Antigo');
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  await expect(page.getByRole('status')).toContainText('Rascunho salvo');
  await page.reload();
  await expect(page.getByLabel('Nome do encontro')).toHaveValue('Caminhada leve pelo Recife Antigo');
  await expect(page.getByText('Fuso deste rascunho: America/Recife')).toBeVisible();

  await expectNoSeriousA11yViolations(page);
  await expectNoHorizontalScroll(page);
  if (capture) {
    await page.screenshot({ path: `.impeccable/review/eventos-rascunho-${capture}.png`, fullPage: true });
    await page.screenshot({ path: `.impeccable/review/eventos-rascunho-${capture}-viewport.png` });
    await page.getByLabel('Tipo de atividade').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Nome do encontro')).toBeFocused();
    await page.screenshot({ path: `.impeccable/review/eventos-rascunho-focus-${capture}.png` });
  }
  if (capture === 'desktop') {
    await page.setViewportSize({ width: 720, height: 450 });
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: '.impeccable/review/eventos-rascunho-zoom200.png', fullPage: true });
    await page.screenshot({ path: '.impeccable/review/eventos-rascunho-zoom200-viewport.png' });
    await page.setViewportSize({ width: 1440, height: 900 });
  }

  const previewResponse = page.waitForResponse((response) => response.url().endsWith(`/api/events/drafts/${eventId}/preview`) && response.request().method() === 'GET');
  await page.getByRole('button', { name: 'Ver prévia' }).click();
  const publicData = (await (await previewResponse).json()).data as Record<string, unknown>;
  expect(publicData).not.toHaveProperty('exactLocation');
  expect(publicData).not.toHaveProperty('approximateArea');
  const publicLocation = publicData.location as Record<string, unknown>;
  expect(publicLocation.approximateArea).toEqual(expect.objectContaining({
    latitude: expect.any(Number),
    longitude: expect.any(Number),
    radiusMeters: expect.any(Number),
  }));
  expect(publicLocation).not.toHaveProperty('exactLocation');
  expect(JSON.stringify(publicData)).not.toContain('-8.0476');
  expect(JSON.stringify(publicData)).not.toContain('-34.877');
  const dialog = page.getByRole('dialog', { name: 'Caminhada leve pelo Recife Antigo' });
  await expect(dialog).toContainText('Recife · PE');
  await expect(dialog).toContainText('ponto exato permanece privado.');
  await expect(dialog.getByRole('region', { name: 'Mapa da área aproximada do encontro' })).toBeVisible();
  await expect(dialog).not.toContainText('-8.0476');
  await expect(dialog).not.toContainText('-34.877');
  await expectNoSeriousA11yViolations(page);
  if (capture) {
    await page.screenshot({ path: `.impeccable/review/eventos-previa-${capture}.png`, fullPage: true });
    await page.screenshot({ path: `.impeccable/review/eventos-previa-${capture}-viewport.png` });
  }
  await dialog.getByRole('button', { name: 'Voltar ao rascunho' }).click();

  await page.getByRole('button', { name: 'Publicar' }).click();
  const confirmation = page.getByRole('dialog', { name: 'Publicar este encontro?' });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Confirmar publicação' }).click();
  await expect(page.getByRole('status')).toContainText('Encontro publicado');
  await expect(page.getByRole('button', { name: 'Salvar rascunho' })).toHaveCount(0);
  await expectNoHorizontalScroll(page);
});

test('eventos: valida localização dependente, preserva edição na indisponibilidade e trata sessão expirada', async ({ page }) => {
  const email = await registerAccount(page, 'eventos-erros');
  await page.goto('/entrar');
  await signIn(page, email);
  await expect(page).toHaveURL(/\/inicio$/);
  await makeNewestAccountHostEligible();
  await page.goto('/eventos/novo');
  await page.getByRole('button', { name: 'Criar rascunho' }).click();
  await expect(page).toHaveURL(/\/eventos\/novo\/[0-9a-f-]+$/i);
  const eventId = page.url().split('/').at(-1);
  if (!eventId) throw new Error('A rota identificada do evento não contém seu id.');
  const errors = page.locator('[role="alert"][aria-labelledby="event-error-title"]');

  await page.getByLabel('Nome do encontro').fill('Encontro ainda em preparação');
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  await expect(page.getByRole('status')).toContainText('Rascunho salvo');
  const future = new Date(Date.now() + 3 * 24 * 60 * 60_000).toISOString().slice(0, 16);
  await page.getByLabel('Início (data e hora)').fill(future);
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  await expect(errors).toContainText('Escolha primeiro o município para definir o fuso horário.');
  await page.getByLabel('Início (data e hora)').fill('');

  await page.route(`**/api/events/drafts/${eventId}`, (route) => route.abort());
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  await expect(errors).toContainText('Não conseguimos concluir agora.');
  await expect(page.getByLabel('Nome do encontro')).toHaveValue('Encontro ainda em preparação');
  await page.unroute(`**/api/events/drafts/${eventId}`);

  await page.context().clearCookies();
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  await expect(errors).toContainText('Sua sessão terminou');
  const expired = errors;
  await expect(expired.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar');
  await expect(page.getByLabel('Nome do encontro')).toHaveValue('Encontro ainda em preparação');
});

test('eventos: busca um local, ajusta o pino por teclado e respeita movimento reduzido', async ({ page }) => {
  const email = await registerAccount(page, 'eventos-mapa');
  await page.goto('/entrar');
  await signIn(page, email);
  await expect(page).toHaveURL(/\/inicio$/);
  await makeNewestAccountHostEligible();
  await page.goto('/eventos/novo');
  await page.getByRole('button', { name: 'Criar rascunho' }).click();
  await expect(page).toHaveURL(/\/eventos\/novo\/[0-9a-f-]+$/i);
  const eventId = page.url().split('/').at(-1);
  if (!eventId) throw new Error('A rota identificada do evento não contém seu id.');

  const searchQueries: string[] = [];
  await page.route(`**/api/events/drafts/${eventId}/location-search`, async (route) => {
    const body = route.request().postDataJSON() as { query?: string };
    const query = body.query ?? '';
    searchQueries.push(query);
    const results = query
      ? [{ kind: 'place', label: 'Praça do Arsenal, Recife, Pernambuco', latitude: -8.0631, longitude: -34.8711 }]
      : [{ kind: 'municipality', label: 'Recife, Pernambuco', latitude: -8.0476, longitude: -34.877 }];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { results }, message: 'Location search completed.', statusCode: 200 }) });
  });

  await page.getByLabel('Tipo de atividade').selectOption({ label: 'Caminhada' });
  await page.getByLabel('Nome do encontro').fill('Ponto de encontro no Recife Antigo');
  await page.getByLabel('Sobre o encontro').fill('Vamos encontrar um ponto público e ajustar a marca no mapa.');
  await page.getByLabel('Estado').selectOption('PE');
  const municipality = page.getByRole('combobox', { name: 'Município' });
  await municipality.fill('Recife');
  await page.getByRole('option', { name: 'Recife', exact: true }).click();
  await page.getByLabel('Categoria de local').selectOption('public_place');
  await page.getByRole('checkbox', { name: 'Confirmo que o encontro não acontecerá em uma residência.' }).check();

  const initialSearch = page.waitForResponse((response) => response.url().endsWith(`/api/events/drafts/${eventId}/location-search`) && response.request().method() === 'POST' && (response.request().postData() ?? '').includes('"query":""'));
  await page.getByRole('button', { name: 'Salvar cidade e abrir mapa' }).click();
  await initialSearch;
  await expect(page.locator('#event-location-search-status')).toContainText('Mapa centralizado em Recife');
  expect(searchQueries).toEqual(['']);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Ampliar mapa' }).click();
  const mapDialog = page.getByRole('dialog', { name: 'Escolha o ponto do encontro' });
  await expect(mapDialog).toBeVisible();
  await mapDialog.getByLabel('Nome do local').fill('Praça do Arsenal');
  expect(searchQueries).toEqual(['']);
  const explicitSearch = page.waitForResponse((response) => response.url().endsWith(`/api/events/drafts/${eventId}/location-search`) && response.request().method() === 'POST' && (response.request().postData() ?? '').includes('Praça do Arsenal'));
  await mapDialog.getByRole('button', { name: 'Buscar local' }).click();
  await explicitSearch;
  expect(searchQueries).toEqual(['', 'Praça do Arsenal']);

  await mapDialog.getByRole('button', { name: /Praça do Arsenal.*Mover pino/ }).click();
  const map = mapDialog.getByRole('region', { name: /Mapa para posicionar o ponto do encontro/ });
  await map.focus();
  await page.keyboard.press('ArrowRight');
  await page.evaluate(() => {
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (options?: boolean | ScrollIntoViewOptions) {
      document.documentElement.dataset.testLastScrollBehavior = typeof options === 'object' ? options.behavior ?? 'auto' : 'auto';
      original.call(this, options);
    };
  });
  await mapDialog.getByRole('button', { name: 'Usar esse ponto' }).click();
  await expect(mapDialog).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-test-last-scroll-behavior', 'auto');

  const saved = page.waitForResponse((response) => response.url().endsWith(`/api/events/drafts/${eventId}`) && response.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  const savedResponse = await saved;
  const savedDraft = (await savedResponse.json()).data as { exactLocation: { latitude: number; longitude: number } };
  expect(savedDraft.exactLocation.latitude).toBeCloseTo(-8.0631, 3);
  expect(savedDraft.exactLocation.longitude).not.toBeCloseTo(-34.8711, 5);
  await expect(page.getByRole('status').filter({ hasText: 'Rascunho salvo' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('-8.0631');
  await expect(page.locator('body')).not.toContainText('-34.8711');

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.getByRole('button', { name: 'Ampliar mapa' })).toBeVisible();
  await page.getByRole('button', { name: 'Ampliar mapa' }).click();
  const expandedMap = page.getByRole('dialog', { name: 'Escolha o ponto do encontro' });
  await expandedMap.getByLabel('Voltar ao formulário').click();
  await expect(expandedMap).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-test-last-scroll-behavior', 'smooth');
});
