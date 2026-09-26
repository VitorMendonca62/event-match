export type RegistrationErrorCode =
  | 'INVALID_CONTACT'
  | 'WHATSAPP_CONSENT_REQUIRED'
  | 'INVALID_PASSWORD'
  | 'WEAK_PASSWORD'
  | 'INVALID_BIRTH_DATE'
  | 'INVALID_DISPLAY_NAME'
  | 'INVALID_REGION'
  | 'INVALID_USAGE_INTENTS'
  | 'VERIFICATION_UNAVAILABLE'
  | 'REGISTRATION_UNAVAILABLE'
  | 'CONTACT_UNAVAILABLE'
  | 'ACCOUNT_CANNOT_BE_ACTIVATED';

/** Framework-independent error; presentation adapters translate codes into neutral responses. */
export class RegistrationError extends Error {
  constructor(readonly code: RegistrationErrorCode) {
    super(code);
    this.name = 'RegistrationError';
  }
}

export function isRegistrationError(
  error: unknown,
  code?: RegistrationErrorCode,
): error is RegistrationError {
  return error instanceof RegistrationError && (code === undefined || error.code === code);
}
