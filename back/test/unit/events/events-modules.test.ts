import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { CreateEventDraft, GetEventDraft, PreviewEventDraft, PublishEvent, UpdateEventDraft } from '../../../src/modules/events/application/use-cases/event.use-cases';
import { EventsModule } from '../../../src/modules/events/events.module';
import { validateEnv } from '../../../src/shared/infrastructure/config/env';

describe('EventsModule composition (SDD-025)', () => {
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: [ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true, validate: validateEnv }), EventsModule] }).compile();
  });

  afterAll(async () => { await module.close(); });

  test('resolves every event use case through DI tokens without forward references', () => {
    for (const useCase of [CreateEventDraft, GetEventDraft, UpdateEventDraft, PreviewEventDraft, PublishEvent]) expect(module.get(useCase)).toBeInstanceOf(useCase);
  });
});
