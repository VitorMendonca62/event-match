export const EVENT_TELEMETRY_PORT = Symbol('EVENT_TELEMETRY_PORT');

export type EventTelemetryOutcome = 'success' | 'conflict' | 'rejected';
export type EventTelemetryEntry = Readonly<{ name: 'draft.create' | 'draft.read' | 'draft.update' | 'draft.preview' | 'event.publish'; outcome: EventTelemetryOutcome; correlationId: string }>;

export interface EventTelemetryPort {
  record(entry: EventTelemetryEntry): void;
}
