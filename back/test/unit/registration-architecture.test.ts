import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const root = join(process.cwd(), 'src/modules/registration');
const collect = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? collect(join(directory, entry.name)) : [join(directory, entry.name)]);
describe('registration architecture', () => {
  test('keeps framework, driver and crypto imports outside domain/application', () => {
    for (const layer of ['domain', 'application']) for (const file of collect(join(root, layer))) expect(readFileSync(file, 'utf8')).not.toMatch(/from ['"](?:drizzle-orm|pg|@nestjs\/|node:crypto)/);
  });
});
