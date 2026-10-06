import { describe, expect, mock, test } from 'bun:test';
import { ListActiveActivityPreferences } from '../../../src/modules/catalog/application/use-cases/list-active-activity-preferences.use-case';

describe('activity preference catalog (ADR-044)', () => {
  test('lists active entries in catalog order through the injected transaction and locale', async () => {
    const context = {};
    const uow = { execute: <T>(work: (value: object) => Promise<T>) => work(context) };
    const entries = [{ code: 'outdoor', label: 'Ao ar livre', active: true }, { code: 'indoor', label: 'Ambiente interno', active: true }];
    const preferences = { listActive: mock(async () => entries), findByCodes: mock(async () => []) };
    await expect(new ListActiveActivityPreferences(uow, preferences).execute('pt-BR')).resolves.toEqual(entries);
    expect(preferences.listActive).toHaveBeenCalledWith(context, 'pt-BR');
    expect(preferences.findByCodes).not.toHaveBeenCalled();
  });
});
