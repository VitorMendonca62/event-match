import { describe, expect, mock, test } from 'bun:test';
import { ListActiveLanguages } from '../../../src/modules/catalog/application/use-cases/list-active-languages.use-case';

describe('language catalog', () => {
  test('lists active entries through the injected transaction and locale', async () => {
    const context = {};
    const uow = { execute: <T>(work: (value: object) => Promise<T>) => work(context) };
    const languages = { listActive: mock(async () => [{ code: 'pt', label: 'Português', active: true }]), findByCodes: mock(async () => []) };
    await expect(new ListActiveLanguages(uow, languages).execute('pt-BR')).resolves.toEqual([{ code: 'pt', label: 'Português', active: true }]);
    expect(languages.listActive).toHaveBeenCalledWith(context, 'pt-BR');
  });
});
