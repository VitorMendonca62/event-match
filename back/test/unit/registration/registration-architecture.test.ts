import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const modulesRoot = join(process.cwd(), 'src/modules');
const collect = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? collect(join(directory, entry.name)) : [join(directory, entry.name)],
  );
const FORBIDDEN_IMPORT = /from ['"](?:drizzle-orm|pg|@nestjs\/|node:|[^'"]*\/infrastructure\/)/;

describe('hexagonal boundaries', () => {
  test.each(['registration', 'profiles', 'catalog'])(
    '%s keeps framework, driver, crypto and infrastructure imports out of domain/application',
    (module) => {
      for (const layer of ['domain', 'application']) {
        const directory = join(modulesRoot, module, layer);
        let files: string[] = [];
        try {
          files = collect(directory);
        } catch {
          continue;
        }
        for (const file of files) expect({ file, source: readFileSync(file, 'utf8') }).not.toMatchObject({ source: expect.stringMatching(FORBIDDEN_IMPORT) });
      }
    },
  );
});
