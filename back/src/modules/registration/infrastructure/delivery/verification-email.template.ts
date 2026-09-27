/**
 * Versioned pt-BR e-mail templates (ADR-024). They receive only the values they render and never
 * mention whether an account exists beyond the neutral recovery notice (RNF004).
 */
export const VERIFICATION_EMAIL_TEMPLATE_VERSION = 'verification-email/v2';

/** BFF callback that exchanges the link token for a continuation cookie (TASK 07, ADR-022). */
export const EMAIL_LINK_CALLBACK_PATH = '/api/registration/contact-verification/confirm-link';

export interface RenderedEmail {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

const COLORS = Object.freeze({
  background: '#09090b',
  card: '#18181b',
  border: '#2a2a2e',
  primary: '#e11d48',
  primaryHover: '#fb3c5a',
  foreground: '#fafafa',
  mutedForeground: '#a1a1aa',
});

function renderShell(input: { preheader: string; title: string; content: string }): string {
  return (
    '<!doctype html>' +
    '<html lang="pt-BR">' +
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    `<body style="margin:0;padding:0;background:${COLORS.background};color:${COLORS.foreground};font-family:Arial,Helvetica,sans-serif;">` +
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(input.preheader)}</div>` +
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:${COLORS.background};">` +
    '<tr><td align="center" style="padding:40px 16px;">' +
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:560px;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:16px;">` +
    '<tr><td style="padding:32px;">' +
    `<p style="margin:0 0 24px;color:${COLORS.primary};font-size:22px;font-weight:700;letter-spacing:-0.3px;">EventMatch</p>` +
    `<h1 style="margin:0 0 16px;color:${COLORS.foreground};font-size:26px;line-height:1.25;">${escapeHtml(input.title)}</h1>` +
    input.content +
    `<p style="margin:32px 0 0;padding-top:20px;border-top:1px solid ${COLORS.border};color:${COLORS.mutedForeground};font-size:12px;line-height:1.6;">Esta é uma mensagem automática do EventMatch. Não responda a este e-mail.</p>` +
    '</td></tr></table>' +
    `<p style="margin:18px 0 0;color:${COLORS.mutedForeground};font-size:12px;">EventMatch · Companhia para viver a cidade</p>` +
    '</td></tr></table>' +
    '</body></html>'
  );
}

export function buildEmailLink(frontendPublicUrl: string, token: string): string {
  const url = new URL(EMAIL_LINK_CALLBACK_PATH, frontendPublicUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

export function renderVerificationEmail(input: { otp: string; link: string | null; ttlMinutes: number }): RenderedEmail {
  const linkText = input.link ? `\n\nOu confirme pelo link: ${input.link}` : '';
  const safeOtp = escapeHtml(input.otp);
  const safeTtl = escapeHtml(String(input.ttlMinutes));
  const linkHtml = input.link
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 0;"><tr><td style="background:${COLORS.primary};border-radius:10px;"><a href="${escapeHtml(input.link)}" style="display:inline-block;padding:14px 22px;color:${COLORS.foreground};font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">Confirmar meu e-mail</a></td></tr></table>`
    : '';
  return {
    subject: 'Seu código de verificação do EventMatch',
    text:
      `Seu código de verificação do EventMatch é ${input.otp}.` +
      `\nEle vale por ${input.ttlMinutes} minutos e só pode ser usado uma vez.${linkText}` +
      '\n\nSe você não pediu este código, ignore esta mensagem.',
    html: renderShell({
      preheader: `Seu código de verificação é ${input.otp}.`,
      title: 'Confirme seu e-mail',
      content:
        `<p style="margin:0 0 18px;color:${COLORS.mutedForeground};font-size:16px;line-height:1.6;">Use o código abaixo para continuar seu cadastro:</p>` +
        `<div style="margin:0;padding:20px;background:${COLORS.background};border:1px solid ${COLORS.border};border-radius:12px;color:${COLORS.foreground};font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;">${safeOtp}</div>` +
        `<p style="margin:18px 0 0;color:${COLORS.mutedForeground};font-size:14px;line-height:1.6;">Ele vale por <strong style="color:${COLORS.foreground};">${safeTtl} minutos</strong> e só pode ser usado uma vez.</p>` +
        linkHtml +
        `<p style="margin:28px 0 0;color:${COLORS.mutedForeground};font-size:13px;line-height:1.6;">Se você não pediu este código, ignore esta mensagem.</p>`,
    }),
  };
}

export function renderRecoveryNoticeEmail(): RenderedEmail {
  return {
    subject: 'Pedido de cadastro no EventMatch',
    text:
      'Recebemos um pedido de cadastro no EventMatch com este e-mail, que já está em uso.' +
      '\nSe foi você, continue o cadastro já iniciado ou entre na sua conta.' +
      '\nSe não foi você, ignore esta mensagem.',
    html: renderShell({
      preheader: 'Recebemos um pedido de cadastro com este e-mail.',
      title: 'Pedido de cadastro recebido',
      content:
        `<p style="margin:0 0 16px;color:${COLORS.mutedForeground};font-size:16px;line-height:1.6;">Recebemos um pedido de cadastro no EventMatch com este e-mail, que já está em uso.</p>` +
        `<p style="margin:0 0 16px;color:${COLORS.mutedForeground};font-size:16px;line-height:1.6;">Se foi você, continue o cadastro já iniciado ou entre na sua conta.</p>` +
        `<p style="margin:0;color:${COLORS.mutedForeground};font-size:13px;line-height:1.6;">Se não foi você, ignore esta mensagem.</p>`,
    }),
  };
}
