export class RegistrationError extends Error {
  constructor(readonly code: string) { super(code); }
}
