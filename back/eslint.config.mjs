import js from '@eslint/js';
import tseslint from 'typescript-eslint';

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
  {
    files: ['src/modules/**/domain/**/*.ts', 'src/modules/**/application/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['drizzle-orm', 'pg', '@nestjs/*', 'node:crypto'], message: 'Domain and application must remain framework and persistence independent.' }] }],
    },
  },
  {
    files: ['src/modules/**/infrastructure/persistence/**/*.ts'],
    ignores: ['src/modules/**/infrastructure/persistence/schema/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['**/schema/**'], message: 'Only persistence schema files may import schemas across module boundaries.' }] }],
    },
  },
);
