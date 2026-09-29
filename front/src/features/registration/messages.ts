import type { ApiResult } from './api-client';
import type { PublicErrorReason } from './contracts';

/** Neutral, non-enumerating copy (plan §4.5). No message tells contact, account or limit states apart. */
export const MESSAGES = {
  requestSent: 'Se for possível usar este e-mail, enviaremos um código. Confira também spam e lixo eletrônico.',
  otpRejected: 'Não foi possível confirmar o código. Verifique e tente novamente.',
  expired: 'Seu cadastro expirou. Comece novamente.',
  conflict: 'Seu cadastro mudou em outra aba ou dispositivo. Atualizamos para a etapa certa.',
  conflictPersistent: 'Não conseguimos sincronizar seu cadastro. Recomece para continuar com segurança.',
  unavailable: 'O cadastro não está disponível no momento. Tente novamente mais tarde.',
  failed: 'Não conseguimos concluir agora. Verifique sua conexão e tente novamente.',
  invalid: 'Alguns dados não estão no formato esperado. Revise os campos destacados.',
  underage: 'O EventMatch é exclusivo para pessoas com 18 anos ou mais. Nenhum dado foi guardado.',
  cancelFailed: 'Não conseguimos cancelar agora. Tente novamente em instantes.',
  consentRequired: 'Aceite os três documentos para continuar.',
  documentsChanged: 'Os documentos foram atualizados. Leia as versões atuais e aceite novamente para continuar.',
  emailVerified: 'E-mail confirmado. Agora escolha sua senha.',
  linkFailed: 'Não foi possível confirmar por este link. Ele pode ter expirado ou já ter sido usado. Use o código enviado ou peça um novo.',
} as const;

const REASONS: Record<PublicErrorReason, string> = {
  invalid_contact: 'Confira o e-mail digitado.',
  invalid_password: 'A senha precisa ter entre 8 e 256 caracteres.',
  weak_password: 'Essa senha é muito comum. Escolha outra, de preferência uma frase longa.',
  invalid_birth_date: 'Confira a data de nascimento.',
  invalid_display_name: 'Confira o nome. Use até 60 caracteres, sem conteúdo ofensivo.',
  invalid_region: 'Confira a região. Use até 80 caracteres.',
  invalid_usage_intents: 'Escolha pelo menos uma forma de usar o EventMatch.',
  activation_unavailable:
    'Não foi possível ativar sua conta com estes dados. Revise a data de nascimento, os documentos e os interesses.',
};

export function messageForReason(reason: PublicErrorReason | undefined): string {
  return reason ? REASONS[reason] : MESSAGES.invalid;
}

/** Generic mapping for outcomes that do not need a step-specific message. */
export function messageForFailure(result: Exclude<ApiResult<unknown>, { kind: 'ok' }>): string {
  switch (result.kind) {
    case 'invalid':
      return MESSAGES.invalid;
    case 'expired':
      return MESSAGES.expired;
    case 'conflict':
      return MESSAGES.conflict;
    case 'unprocessable':
      return messageForReason(result.reason);
    case 'unavailable':
      return MESSAGES.unavailable;
    case 'failed':
      return MESSAGES.failed;
  }
}
