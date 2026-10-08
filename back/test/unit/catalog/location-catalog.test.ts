import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { ListActiveFederativeUnits } from '../../../src/modules/catalog/application/use-cases/list-active-federative-units.use-case';
import { SearchMunicipalities } from '../../../src/modules/catalog/application/use-cases/search-municipalities.use-case';
import { LocationCatalogController } from '../../../src/modules/catalog/presentation/http/controllers/location.controller';
import { configureApplication } from '../../../src/main';
import { validateEnv } from '../../../src/shared/infrastructure/config/env';

describe('location catalog HTTP contract (SDD-023)', () => {
  let app: INestApplication;
  const units = { execute: mock(async () => [{ code: 'DF' as const, name: 'Distrito Federal' }]) };
  const municipalities = { execute: mock(async (input: { ufCode: string; query?: string }) => [{ municipalityCode: '5300108', municipalityName: 'Brasília', ufCode: input.ufCode, active: true }]) };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true, validate: (environment) => validateEnv(environment) })],
      controllers: [LocationCatalogController],
      providers: [
        { provide: ListActiveFederativeUnits, useValue: units },
        { provide: SearchMunicipalities, useValue: municipalities },
      ],
    }).compile();
    app = module.createNestApplication();
    configureApplication(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  test('lists public UFs and searches municipalities without a session', async () => {
    const federativeUnits = await request(app.getHttpServer()).get('/api/v1/catalog/federative-units').expect(200);
    expect(federativeUnits.body).toEqual({ data: { federativeUnits: [{ code: 'DF', name: 'Distrito Federal' }] }, message: 'Estados disponíveis.', statusCode: 200 });

    const search = await request(app.getHttpServer()).get('/api/v1/catalog/municipalities?uf=DF&q=Bras').expect(200);
    expect(search.body).toEqual({ data: { municipalities: [{ code: '5300108', name: 'Brasília', ufCode: 'DF' }] }, message: 'Municípios disponíveis.', statusCode: 200 });
    expect(municipalities.execute).toHaveBeenCalledWith({ ufCode: 'DF', query: 'Bras' });
  });

  test('rejects an invalid UF before invoking the search use case', async () => {
    municipalities.execute.mockClear();
    await request(app.getHttpServer()).get('/api/v1/catalog/municipalities?uf=XX&q=Bras').expect(400);
    expect(municipalities.execute).not.toHaveBeenCalled();
  });

  test('maps catalog failures to the documented safe 503 envelope', async () => {
    units.execute.mockRejectedValueOnce(new Error('database unavailable'));
    const unitsUnavailable = await request(app.getHttpServer()).get('/api/v1/catalog/federative-units').expect(503);
    expect(unitsUnavailable.body).toEqual({ data: {}, message: 'Service is temporarily unavailable.', statusCode: 503 });

    municipalities.execute.mockRejectedValueOnce(new Error('database unavailable'));
    const municipalitiesUnavailable = await request(app.getHttpServer()).get('/api/v1/catalog/municipalities?uf=DF&q=Bras').expect(503);
    expect(municipalitiesUnavailable.body).toEqual({ data: {}, message: 'Service is temporarily unavailable.', statusCode: 503 });
  });
});
