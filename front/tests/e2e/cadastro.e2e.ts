import { lastOtp } from './support/brevo';
import { expireLatestVerification } from './support/db';
import {
  advanceTo,
  ADULT_BIRTH_DATE,
  chooseInterests,
  confirmOtp,
  DOCUMENT_TITLES,
  expectLanding,
  expectStep,
  fillBirth,
  fillEmail,
  fillOtp,
  fillPassword,
  fillRequiredData,
  finish,
  goToReview,
  MINOR_BIRTH_DATE,
  stepHeading,
  TITLES,
  uniqueEmail,
} from './support/flow';
import { expect, test } from './support/test';

const OTP_REJECTED = 'Não foi possível confirmar o código. Verifique e tente novamente.';
const COOKIE_NAME = 'eventmatch_registration';

test('1. caminho feliz até a conclusão, sem resíduos no navegador', async ({ page, context }) => {
  const email = uniqueEmail('feliz');
  await page.goto('/');
  await page.getByRole('link', { name: 'Começar meu cadastro' }).click();
  await expect(page).toHaveURL(/\/cadastro$/);
  await expectLanding(page, TITLES.birth);
  await fillBirth(page);
  await expectStep(page, TITLES.contact);
  await fillEmail(page, email);
  await expectStep(page, TITLES.otp);
  await confirmOtp(page, email);
  await expectStep(page, TITLES.password);
  await fillPassword(page);
  await expectStep(page, TITLES.requiredData);
  await fillRequiredData(page);
  await expectStep(page, TITLES.interests);
  await chooseInterests(page, 3);
  await goToReview(page);
  await expectStep(page, TITLES.review);
  const accepted = page.getByRole('definition').filter({ hasText: 'Termos de Uso' });
  for (const title of DOCUMENT_TITLES) await expect(accepted).toContainText(title);
  await finish(page);

  await expect(page).toHaveURL(/\/cadastro\/concluido$/);
  await expect(page.getByText('Sua conta está ativa.')).toBeVisible();
  expect((await context.cookies()).find((cookie) => cookie.name === COOKIE_NAME)).toBeUndefined();
  expect(await page.evaluate(() => window.sessionStorage.length)).toBe(0);
});

test('3. menor de idade não avança nem informa contato', async ({ page, context }) => {
  await page.goto('/cadastro');
  await fillBirth(page, MINOR_BIRTH_DATE);
  await expect(page.getByRole('status').filter({ hasText: 'Cadastro indisponível para menores de 18 anos' })).toBeFocused();
  await expect(page.getByLabel('Seu e-mail')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Voltar ao início' })).toBeVisible();
  expect((await context.cookies()).find((cookie) => cookie.name === COOKIE_NAME)).toBeUndefined();
});

test('4. WhatsApp fica desabilitado e não gera requisição', async ({ page }) => {
  await page.goto('/cadastro');
  await fillBirth(page);
  await expectStep(page, TITLES.contact);
  const whatsapp = page.getByRole('radio', { name: "WhatsApp", exact: false });
  await expect(whatsapp).toBeDisabled();
  await expect(page.getByText('Em breve')).toBeVisible();

  let apiCalls = 0;
  page.on('request', (call) => {
    if (call.url().includes('/api/')) apiCalls += 1;
  });
  await page.getByText('WhatsApp').click({ force: true });
  await expect(page.getByRole('radio', { name: "E-mail", exact: true })).toBeChecked();
  expect(apiCalls).toBe(0);
});

test('5. OTP: erro neutro, bloqueio após cinco erros, reenvio em espera e código expirado', async ({ page }) => {
  const email = uniqueEmail('otp');
  await advanceTo(page, email, 'otp');
  const real = await lastOtp(email);
  const wrong = real === '000000' ? '111111' : '000000';

  await expect(page.getByRole('button', { name: /Reenviar em/ })).toBeDisabled();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await fillOtp(page, wrong);
    await expect(page.getByText(OTP_REJECTED)).toBeVisible();
  }
  // Locked: even the right code gets the same neutral answer, revealing nothing about the state.
  await fillOtp(page, real);
  await expect(page.getByText(OTP_REJECTED)).toBeVisible();
  await expect(stepHeading(page, TITLES.otp)).toBeVisible();
});

test('5b. OTP expirado por ajuste de expires_at recebe a mesma resposta neutra', async ({ page }) => {
  const email = uniqueEmail('expirado');
  await advanceTo(page, email, 'otp');
  const code = await lastOtp(email);
  await expireLatestVerification();
  await fillOtp(page, code);
  await expect(page.getByText(OTP_REJECTED)).toBeVisible();
  await expect(stepHeading(page, TITLES.otp)).toBeVisible();
});

test.describe('6. retomada pelo estágio remoto', () => {
  test('reload em otp, password, required_data, interests e review volta à etapa certa', async ({ page }) => {
    const email = uniqueEmail('retoma');
    await advanceTo(page, email, 'otp');
    await page.reload();
    await expect(stepHeading(page, TITLES.otp)).toBeVisible();

    await confirmOtp(page, email);
    await expectStep(page, TITLES.password);
    await page.reload();
    await expect(stepHeading(page, TITLES.password)).toBeVisible();

    await fillPassword(page);
    await expectStep(page, TITLES.requiredData);
    await page.reload();
    await expect(stepHeading(page, TITLES.requiredData)).toBeVisible();

    await fillRequiredData(page);
    await expectStep(page, TITLES.interests);
    await chooseInterests(page, 3);
    await page.reload();
    await expect(stepHeading(page, TITLES.interests)).toBeVisible();
    await expect(page.getByText('3 interesses escolhidos')).toBeVisible();

    await goToReview(page);
    await expectStep(page, TITLES.review);
    await page.reload();
    // The remote stage is `account_incomplete`: the person returns to interests, keeping the draft.
    await expect(stepHeading(page, TITLES.interests)).toBeVisible();
    await goToReview(page);
    await expectStep(page, TITLES.review);
    // Acceptances live only in memory: after a reload the review asks for them again.
    await expect(page.getByRole('heading', { name: 'Confirme os documentos' })).toBeVisible();
  });
});

test('7. sessão expirada: sem cookie, o aviso aparece e o cadastro recomeça', async ({ page, context }) => {
  const email = uniqueEmail('sessao');
  await advanceTo(page, email, 'password');
  await context.clearCookies();
  await fillPassword(page);
  await expect(page.getByRole('status').filter({ hasText: 'Sessão expirada' })).toBeVisible();
  await expectStep(page, TITLES.birth);
});

test('12. menos de três interesses mantém o avanço indisponível com contador textual', async ({ page }) => {
  await advanceTo(page, uniqueEmail('interesses'), 'interests');
  await chooseInterests(page, 2);
  await expect(page.getByText('2 interesses escolhidos · faltam 1')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Revisar cadastro' })).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('button', { name: 'Revisar cadastro' }).click({ force: true }); // aria-disabled: Playwright would wait forever, a person can still click it
  await expect(page.getByRole('alert').filter({ hasText: 'Escolha pelo menos 3 interesses' })).toBeVisible();
  await expect(stepHeading(page, TITLES.interests)).toBeVisible();
});

test('15. armazenamento e cookies: allowlist do sessionStorage, cookie HttpOnly e URL limpa', async ({ page, context }) => {
  const email = uniqueEmail('storage');
  const PASSWORD_MARK = 'Cafe-com-pao';
  await advanceTo(page, email, 'interests');
  await chooseInterests(page, 3);

  const cookie = (await context.cookies()).find((item) => item.name === COOKIE_NAME);
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe('Lax');
  expect(await page.evaluate(() => document.cookie)).not.toContain(COOKIE_NAME);

  const keys = await page.evaluate(() => Object.keys(window.sessionStorage));
  expect(keys).toEqual(['eventmatch.registration']);
  const raw = await page.evaluate(() => window.sessionStorage.getItem('eventmatch.registration'));
  const draftKeys = Object.keys(JSON.parse(raw ?? '{}'));
  expect(draftKeys.sort()).toEqual(
    ['displayName', 'interestIds', 'localStep', 'ufCode', 'municipalityCode', 'municipalityName', 'schemaVersion', 'touchedAt', 'usageIntents'].sort(),
  );
  for (const secret of [email, PASSWORD_MARK, ADULT_BIRTH_DATE, 'token=']) expect(raw).not.toContain(secret);
  expect(await page.evaluate(() => window.localStorage.length)).toBe(0);
  expect(page.url()).not.toContain('token=');
  expect(await page.evaluate(() => document.referrer + window.location.search)).not.toContain('token=');
});
