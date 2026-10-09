import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';

import { UNIT_OF_WORK_PORT } from '../../shared/application/ports/unit-of-work.port';
import { useCaseProvider } from '../../shared/infrastructure/nest/use-case.provider';
import { PersistenceModule } from '../../shared/infrastructure/persistence/persistence.module';
import { NoStoreMiddleware } from '../../shared/presentation/http/no-store.middleware';
import { CatalogModule } from '../catalog/catalog.module';
import { MUNICIPALITY_CATALOG_READER_PORT } from '../catalog/domain/ports/municipality-catalog-reader.port';
import { IdentityAccessModule } from '../identity-access/identity-access.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { HOST_ELIGIBILITY_PORT } from '../profiles/domain/ports/host-eligibility.port';
import { CreateEventDraft, GetEventDraft, PreviewEventDraft, PublishEvent, UpdateEventDraft } from './application/use-cases/event.use-cases';
import { APPROXIMATE_EVENT_AREA_PROJECTOR_PORT } from './domain/ports/approximate-event-area-projector.port';
import { EVENT_ACTIVITY_TYPE_CATALOG_PORT } from './domain/ports/event-activity-type-catalog.port';
import { EVENT_AUDIT_PORT } from './domain/ports/event-audit.port';
import { EVENT_REPOSITORY_PORT } from './domain/ports/event-repository.port';
import { EVENT_TELEMETRY_PORT } from './domain/ports/event-telemetry.port';
import { EXACT_LOCATION_PROTECTOR_PORT } from './domain/ports/exact-location-protector.port';
import { HOST_EVENT_LIMIT_PORT } from './domain/ports/host-event-limit.port';
import { DrizzleEventActivityTypeCatalogAdapter } from './infrastructure/persistence/drizzle-event-activity-type-catalog.adapter';
import { DrizzleEventRepositoryAdapter } from './infrastructure/persistence/drizzle-event-repository.adapter';
import { DrizzleHostEventLimitAdapter } from './infrastructure/persistence/drizzle-host-event-limit.adapter';
import { DrizzleEventAuditAdapter } from './infrastructure/observability/drizzle-event-audit.adapter';
import { LoggerEventTelemetryAdapter } from './infrastructure/observability/logger-event-telemetry.adapter';
import { AesExactLocationAdapter } from './infrastructure/security/aes-exact-location.adapter';
import { DeterministicAreaProjectorAdapter } from './infrastructure/security/deterministic-area-projector.adapter';
import { EventsController } from './presentation/http/controllers/events.controller';
import { EventsBffGuard, EventsCapabilityGuard } from './presentation/http/events-auth.guard';

const eventUseCaseDependencies = [UNIT_OF_WORK_PORT, EVENT_REPOSITORY_PORT, HOST_ELIGIBILITY_PORT, HOST_EVENT_LIMIT_PORT, EVENT_ACTIVITY_TYPE_CATALOG_PORT, MUNICIPALITY_CATALOG_READER_PORT, EXACT_LOCATION_PROTECTOR_PORT, APPROXIMATE_EVENT_AREA_PROJECTOR_PORT, EVENT_AUDIT_PORT, EVENT_TELEMETRY_PORT];

@Module({
  imports: [PersistenceModule, CatalogModule, ProfilesModule, IdentityAccessModule],
  controllers: [EventsController],
  providers: [
    { provide: EXACT_LOCATION_PROTECTOR_PORT, useClass: AesExactLocationAdapter },
    { provide: APPROXIMATE_EVENT_AREA_PROJECTOR_PORT, useClass: DeterministicAreaProjectorAdapter },
    { provide: EVENT_REPOSITORY_PORT, useClass: DrizzleEventRepositoryAdapter },
    { provide: HOST_EVENT_LIMIT_PORT, useClass: DrizzleHostEventLimitAdapter },
    { provide: EVENT_ACTIVITY_TYPE_CATALOG_PORT, useClass: DrizzleEventActivityTypeCatalogAdapter },
    { provide: EVENT_AUDIT_PORT, useClass: DrizzleEventAuditAdapter },
    { provide: EVENT_TELEMETRY_PORT, useClass: LoggerEventTelemetryAdapter },
    useCaseProvider(CreateEventDraft, eventUseCaseDependencies),
    useCaseProvider(GetEventDraft, eventUseCaseDependencies),
    useCaseProvider(UpdateEventDraft, eventUseCaseDependencies),
    useCaseProvider(PreviewEventDraft, eventUseCaseDependencies),
    useCaseProvider(PublishEvent, eventUseCaseDependencies),
    EventsBffGuard, EventsCapabilityGuard,
  ],
})
export class EventsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void { consumer.apply(NoStoreMiddleware).forRoutes(EventsController); }
}
