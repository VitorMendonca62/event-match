import { Injectable } from '@nestjs/common';

import { bffInternalGuardFor } from '../../../../shared/presentation/http/bff-internal.guard';

/** `/api/v1/auth`: the shared BFF credential guard behind `AUTH_HTTP_ENABLED` (ADR-034). */
@Injectable()
export class AuthBffGuard extends bffInternalGuardFor('AUTH_HTTP_ENABLED') {}
