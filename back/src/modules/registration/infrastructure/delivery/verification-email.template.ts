/**
 * Versioned pt-BR e-mail templates (ADR-024). They receive only the values they render and never
 * mention whether an account exists beyond the neutral recovery notice (RNF004).
 */
export const VERIFICATION_EMAIL_TEMPLATE_VERSION = 'verification-email/v1';

/** BFF callback that exchanges the link token for a continuation cookie (TASK 07, ADR-022). */
export const EMAIL_LINK_CALLBACK_PATH = '/api/registration/contact-verification/confirm-link';

export interface RenderedEmail {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

export function buildEmailLink(frontendPublicUrl: string, token: string): string {
  const url = new URL(EMAIL_LINK_CALLBACK_PATH, frontendPublicUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

export function renderVerificationEmail(input: { otp: string; link: string | null; ttlMinutes: number }): RenderedEmail {
  const linkText = input.link ? `\n\nOu confirme pelo link: ${input.link}` : '';
  const linkHtml = input.link
    ? `<p><a href="${escapeHtml(input.link)}">Confirmar meu e-mail</a></p>`
    : '';
  return {
    subject: 'Seu código de verificação do EventMatch',
    text:
      `Seu código de verificação do EventMatch é ${input.otp}.` +
      `\nEle vale por ${input.ttlMinutes} minutos e só pode ser usado uma vez.${linkText}` +
      '\n\nSe você não pediu este código, ignore esta mensagem.',
    html:
      `<p>Seu código de verificação do EventMatch é <strong>${escapeHtml(input.otp)}</strong>.</p>` +
      `<p>Ele vale por ${input.ttlMinutes} minutos e só pode ser usado uma vez.</p>` +
      linkHtml +
      '<p>Se você não pediu este código, ignore esta mensagem.</p>',
  };
}

export function renderRecoveryNoticeEmail(): RenderedEmail {
  return {
    subject: 'Pedido de cadastro no EventMatch',
    text:
      'Recebemos um pedido de cadastro no EventMatch com este e-mail, que já está em uso.' +
      '\nSe foi você, continue o cadastro já iniciado ou entre na sua conta.' +
      '\nSe não foi você, ignore esta mensagem.',
    html:
      '<p>Recebemos um pedido de cadastro no EventMatch com este e-mail, que já está em uso.</p>' +
      '<p>Se foi você, continue o cadastro já iniciado ou entre na sua conta.</p>' +
      '<p>Se não foi você, ignore esta mensagem.</p>',
  };
}
