import { describe, expect, mock, test } from 'bun:test';
import { Test } from '@nestjs/testing';

import { UNIT_OF_WORK_PORT } from '../../../src/shared/application/ports/unit-of-work.port';
import { useCaseProvider } from '../../../src/shared/infrastructure/nest/use-case.provider';
import { EVENT_ACTIVITY_TYPE_CATALOG_PORT } from '../../../src/modules/events/domain/ports/event-activity-type-catalog.port';
import { ListActiveEventActivityTypes } from '../../../src/modules/events/application/use-cases/list-active-event-activity-types.use-case';

describe('ListActiveEventActivityTypes', () => {
  test('reads the locale-specific active catalog through the unit of work and catalog port', async () => {
    const context = {};
    const rows = [{ code: 'caminhada', label: 'Caminhada', active: true }];
    const uow = { execute: mock(async (work: (context: object) => Promise<unknown>) => work(context)) };
    const catalog = { listActive: mock(async () => rows) };
    const module = await Test.createTestingModule({
      providers: [
        { provide: UNIT_OF_WORK_PORT, useValue: uow },
        { provide: EVENT_ACTIVITY_TYPE_CATALOG_PORT, useValue: catalog },
        useCaseProvider(ListActiveEventActivityTypes, [UNIT_OF_WORK_PORT, EVENT_ACTIVITY_TYPE_CATALOG_PORT]),
      ],
    }).compile();

    try {
      await expect(module.get(ListActiveEventActivityTypes).execute('pt-BR')).resolves.toEqual(rows);
      expect(catalog.listActive).toHaveBeenCalledWith(context, 'pt-BR');
    } finally {
      await module.close();
    }
  });
});
