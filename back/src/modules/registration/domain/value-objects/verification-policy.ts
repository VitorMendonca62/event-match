const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Parameters approved in ADR-008, ADR-009, ADR-015, ADR-021 and ADR-023. */
export const REGISTRATION_POLICY = Object.freeze({
  otpTtlMs: 15 * MINUTE_MS,
  lockMs: 20 * MINUTE_MS,
  resendIntervalMs: MINUTE_MS,
  maxAttempts: 5,
  maxResendsPerChallenge: 3,
  maxResendsPerHour: 3,
  maxChallengesPerHour: 5,
  maxChallengesPerOriginPerHour: 10,
  registrationTtlMs: DAY_MS,
  incompleteAccountTtlMs: 15 * DAY_MS,
  minInterests: 3,
  eligibleFlowTtlMs: 30 * MINUTE_MS,
  previousTokenGraceMs: MINUTE_MS,
  idempotencyTtlMs: DAY_MS,
  idempotencyLeaseMs: 30_000,
});

export type RegistrationPolicy = typeof REGISTRATION_POLICY;

/** Fixed UTC hour window used by the abuse limits (ADR-015). */
export function rateWindowStart(now: Date): Date {
  return new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS);
}
