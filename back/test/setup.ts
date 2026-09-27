import 'reflect-metadata';

process.env.DATABASE_URL ??= 'postgresql://eventmatch:eventmatch@localhost:5432/eventmatch';
process.env.DATABASE_POOL_MAX ??= '1';
process.env.DATABASE_IDLE_TIMEOUT_MS ??= '10000';
process.env.DATABASE_CONNECTION_TIMEOUT_MS ??= '2000';
process.env.DATABASE_STATEMENT_TIMEOUT_MS ??= '5000';
process.env.DATABASE_SSL_MODE ??= 'disable';
// Fixed test-only keys: Bun auto-loads back/.env, whose values must never leak into test results.
process.env.CONTACT_HASH_KEY = Buffer.alloc(32, 1).toString('base64');
process.env.CONTACT_ENCRYPTION_KEY = Buffer.alloc(32, 2).toString('base64');
process.env.VERIFICATION_SECRET_KEY = Buffer.alloc(32, 3).toString('base64');
process.env.REGISTRATION_FLOW_SECRET = Buffer.alloc(32, 4).toString('base64');
process.env.BFF_INTERNAL_TOKEN = Buffer.alloc(32, 5).toString('base64');
process.env.VERIFICATION_DELIVERY_MODE = 'noop';
process.env.REGISTRATION_HTTP_ENABLED = 'true';
// Never inherit real provider settings: contract tests point the adapter at a local fake server.
process.env.BREVO_API_KEY = '';
process.env.BREVO_BASE_URL = 'https://api.brevo.com/v3';
process.env.EMAIL_FROM = '';
process.env.FRONTEND_PUBLIC_URL = '';
