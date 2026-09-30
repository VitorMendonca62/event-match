import { Injectable } from '@nestjs/common';

import { bffInternalGuardFor } from '../../../../shared/presentation/http/bff-internal.guard';

/** Registration routes: the shared BFF credential guard behind `REGISTRATION_HTTP_ENABLED`. */
@Injectable()
export class BffInternalGuard extends bffInternalGuardFor('REGISTRATION_HTTP_ENABLED') {}
