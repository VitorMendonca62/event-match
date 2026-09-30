/**
 * Neutral copy of the login and first access (SDD-013 §4.5). No message mentions whether an
 * account exists, its state or a restriction.
 */
export const AUTH_MESSAGES = {
  invalidCredentials: 'Não foi possível entrar. Confira os dados e tente novamente.',
  rateLimited: 'Não foi possível entrar agora. Aguarde um pouco e tente novamente.',
  unavailable: 'Não foi possível entrar agora. Tente novamente em instantes.',
  emailRequired: 'Informe o e-mail que você usou no cadastro.',
  passwordRequired: 'Informe sua senha.',
  logoutFailed: 'Não conseguimos confirmar a saída. Tente novamente.',
} as const;

export type LoginOutcome = 'ok' | 'invalid' | 'rate_limited' | 'unavailable';

/** Reduces the BFF status to what the form may act on; anything unexpected is "unavailable". */
export function loginOutcome(status: number): LoginOutcome {
  if (status >= 200 && status < 300) return 'ok';
  if (status === 400 || status === 401) return 'invalid';
  if (status === 429) return 'rate_limited';
  return 'unavailable';
}

export function messageForLogin(outcome: Exclude<LoginOutcome, 'ok'>): string {
  if (outcome === 'invalid') return AUTH_MESSAGES.invalidCredentials;
  if (outcome === 'rate_limited') return AUTH_MESSAGES.rateLimited;
  return AUTH_MESSAGES.unavailable;
}
