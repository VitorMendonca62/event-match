import type { RefObject } from 'react';

import type { ApiResult } from '../../api-client';

export type Failure = Exclude<ApiResult<unknown>, { kind: 'ok' }>;

/** What every step receives from the flow. */
export type StepBaseProps = Readonly<{
  headingRef: RefObject<HTMLHeadingElement | null>;
  /**
   * Hands a failed call to the flow. Expired sessions and stage conflicts are resolved there and
   * return `null`; any other outcome returns the message the step shows next to its form.
   */
  onFailure: (failure: Failure) => Promise<string | null>;
}>;
