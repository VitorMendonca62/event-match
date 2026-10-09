import type { ApproximateEventArea, ExactLocation } from '../value-objects/event-location';

export const APPROXIMATE_EVENT_AREA_PROJECTOR_PORT = Symbol('APPROXIMATE_EVENT_AREA_PROJECTOR_PORT');

export interface ApproximateEventAreaProjectorPort {
  project(eventId: string, exactLocation: ExactLocation): ApproximateEventArea;
}
