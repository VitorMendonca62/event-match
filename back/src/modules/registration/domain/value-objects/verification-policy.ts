export class VerificationPolicy {
  readonly otpTtlMs = 15 * 60_000;
  readonly lockMs = 20 * 60_000;
  readonly resendIntervalMs = 60_000;
  readonly maxAttempts = 5;
  readonly maxResends = 3;
  readonly maxChallengesPerHour = 5;
}
