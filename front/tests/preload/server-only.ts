import { mock } from 'bun:test';

// `server-only` deliberately throws under Bun's default condition. Next.js resolves its
// `react-server` export during application builds; the test runner needs a no-op marker instead.
mock.module('server-only', () => ({}));
