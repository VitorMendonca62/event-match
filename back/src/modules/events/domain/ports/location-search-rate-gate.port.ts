export const LOCATION_SEARCH_RATE_GATE_PORT = Symbol('LOCATION_SEARCH_RATE_GATE_PORT');

export interface LocationSearchRateGatePort {
  tryAcquire(): Promise<boolean>;
}
