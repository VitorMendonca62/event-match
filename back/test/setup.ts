import 'reflect-metadata';

process.env.DATABASE_URL ??= 'postgresql://eventmatch:eventmatch@localhost:5432/eventmatch';
process.env.DATABASE_POOL_MAX ??= '1';
process.env.DATABASE_IDLE_TIMEOUT_MS ??= '10000';
process.env.DATABASE_CONNECTION_TIMEOUT_MS ??= '2000';
process.env.DATABASE_STATEMENT_TIMEOUT_MS ??= '5000';
process.env.DATABASE_SSL_MODE ??= 'disable';
process.env.CONTACT_HASH_KEY ??= Buffer.alloc(32, 1).toString('base64');
process.env.CONTACT_ENCRYPTION_KEY ??= Buffer.alloc(32, 2).toString('base64');
process.env.VERIFICATION_SECRET_KEY ??= Buffer.alloc(32, 3).toString('base64');
