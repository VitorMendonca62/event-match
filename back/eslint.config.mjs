import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Bounded contexts that own Drizzle schemas (ADR-013).
const schemaOwners = ['registration', 'profiles', 'catalog'];

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  // Adapters use their own module's schema; only schema files may reference another module's
  // tables (foreign keys).
  ...schemaOwners.map((owner) => ({
    files: [`src/modules/${owner}/**/*.ts`],
    ignores: [`src/modules/${owner}/infrastructure/persistence/schema/**/*.ts`],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: schemaOwners
            .filter((other) => other !== owner)
            .map((other) => `**/${other}/infrastructure/persistence/schema/**`),
          message: 'Only persistence schema files may import schemas across module boundaries.',
        }],
      }],
    },
  })),
  // Declared last so it wins for domain/application files, which must not see any schema.
  {
    files: ['src/modules/**/domain/**/*.ts', 'src/modules/**/application/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['drizzle-orm', 'drizzle-orm/*', 'pg', '@nestjs/*', 'node:*', '**/infrastructure/**'],
          message: 'Domain and application must remain framework and persistence independent.',
        }],
      }],
    },
  },
);
