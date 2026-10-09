import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { BackendEnv } from '../../../../shared/infrastructure/config/env';
import type { ApproximateEventAreaProjectorPort } from '../../domain/ports/approximate-event-area-projector.port';
import type { ApproximateEventArea, ExactLocation } from '../../domain/value-objects/event-location';

@Injectable()
export class DeterministicAreaProjectorAdapter implements ApproximateEventAreaProjectorPort {
  private readonly radiusMeters: number;

  constructor(config: ConfigService<BackendEnv, true>) {
    this.radiusMeters = config.getOrThrow<number>('EVENT_APPROXIMATE_RADIUS_METERS');
  }

  project(eventId: string, exactLocation: ExactLocation): ApproximateEventArea {
    const digest = createHash('sha256').update(eventId).digest();
    const angle = (digest.readUInt32BE(0) / 0xffffffff) * Math.PI * 2;
    const distance = this.radiusMeters * 0.35;
    const latitudeDelta = (Math.sin(angle) * distance) / 111_320;
    const longitudeScale = Math.max(Math.cos((exactLocation.latitude * Math.PI) / 180), 0.2);
    const longitudeDelta = (Math.cos(angle) * distance) / (111_320 * longitudeScale);
    return {
      latitude: exactLocation.latitude + latitudeDelta,
      longitude: exactLocation.longitude + longitudeDelta,
      radiusMeters: this.radiusMeters,
    };
  }
}
