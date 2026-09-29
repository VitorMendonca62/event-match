/** Variables exported by `scripts/test-front-e2e.sh`; fails loudly when run outside the runner. */
export function requireEnv(name: 'E2E_FAKE_BREVO_URL' | 'E2E_DATABASE_URL'): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Run the suite with "bun run --cwd front test:e2e".`);
  return value;
}
