import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Res, UseFilters, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';

import {
  BadRequestResponseDto,
  ForbiddenResponseDto,
  NotFoundResponseDto,
  OkResponseDto,
  ServiceUnavailableResponseDto,
  TooManyRequestsResponseDto,
  UnauthorizedResponseDto,
} from '../../../../../shared/presentation/http/api-response.dto';
import { API_V1_PREFIX } from '../../../../../shared/presentation/http/api-version';
import {
  BFF_TOKEN_HEADER,
  ORIGIN_FINGERPRINT_HEADER,
  OriginFingerprint,
} from '../../../../../shared/presentation/http/bff-headers';
import { AuthenticateAccount } from '../../../application/use-cases/authenticate-account.use-case';
import { Logout } from '../../../application/use-cases/logout.use-case';
import { ResolveAuthenticatedSession } from '../../../application/use-cases/resolve-authenticated-session.use-case';
import { AuthBffGuard } from '../auth-bff.guard';
import { SESSION_RESPONSE_HEADER, SessionBearer } from '../auth-headers';
import { LoginRequestDto, SessionQueryDto } from '../dto/auth-request.dto';
import { LoginResponseDto, LogoutResponseDto, SessionResponseDto } from '../dto/auth-response.dto';
import { IdentityAccessErrorFilter } from '../identity-access-error.filter';

export const AUTHENTICATED_SESSION_BEARER = 'authenticated-session';

const FICTITIOUS_TOKEN = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

const sessionHeader = {
  [SESSION_RESPONSE_HEADER]: {
    description: 'New or rotated opaque session token (32 bytes, base64url). Internal: removed by the BFF.',
    schema: { type: 'string', example: FICTITIOUS_TOKEN },
  },
};

/**
 * Authentication contract v1 for the Next.js BFF only (ADR-033..036). It never returns the token
 * in a body, never sets cookies and never enables CORS; the BFF owns the browser cookie (ADR-034).
 */
@ApiTags('auth')
@ApiHeader({
  name: BFF_TOKEN_HEADER,
  required: true,
  description: 'Internal credential of the Next.js BFF (ADR-023). Never exposed to browsers.',
  example: 'ZmljdGljaW91cy1iZmYtdG9rZW4tZm9yLWRvY3MtMzI=',
})
@ApiBadRequestResponse({ type: BadRequestResponseDto })
@ApiUnauthorizedResponse({ type: UnauthorizedResponseDto, description: 'Neutral: never tells why.' })
@ApiNotFoundResponse({ type: NotFoundResponseDto, description: 'Routes disabled by AUTH_HTTP_ENABLED.' })
@ApiServiceUnavailableResponse({ type: ServiceUnavailableResponseDto })
@UseGuards(AuthBffGuard)
@UseFilters(IdentityAccessErrorFilter)
@Controller(`${API_V1_PREFIX}/auth`)
export class AuthController {
  constructor(
    private readonly authenticate: AuthenticateAccount,
    private readonly resolveSession: ResolveAuthenticatedSession,
    private readonly logoutSession: Logout,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate an active account by e-mail and password (RF008)' })
  @ApiHeader({
    name: ORIGIN_FINGERPRINT_HEADER,
    required: true,
    description: 'HMAC of the visitor origin computed by the BFF (32 bytes, base64url). Never an IP.',
    example: FICTITIOUS_TOKEN,
  })
  @ApiOkResponse({ type: LoginResponseDto, headers: sessionHeader })
  @ApiTooManyRequestsResponse({ type: TooManyRequestsResponseDto, description: 'Generic; no bucket or wait time.' })
  async login(
    @Body() body: LoginRequestDto,
    @OriginFingerprint() originFingerprint: Buffer,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authenticate.execute({
      email: body.email,
      password: body.password,
      rememberMe: body.rememberMe,
      originFingerprint,
    });
    response.setHeader(SESSION_RESPONSE_HEADER, result.token);
    return new OkResponseDto(
      {
        authenticated: true,
        expiresAt: result.expiresAt.toISOString(),
        idleExpiresAt: result.idleExpiresAt.toISOString(),
        remembered: result.remembered,
      },
      'Sessão iniciada.',
    );
  }

  @Get('session')
  @ApiOperation({ summary: 'Resolve and authorize the current session with live account state (ADR-036)' })
  @ApiBearerAuth(AUTHENTICATED_SESSION_BEARER)
  @ApiOkResponse({ type: SessionResponseDto, headers: sessionHeader })
  @ApiForbiddenResponse({ type: ForbiddenResponseDto, description: 'Active account; capability denied. Session kept.' })
  async session(
    @SessionBearer() token: string,
    @Query() query: SessionQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const resolved = await this.resolveSession.execute({
      token,
      capability: query.capability ?? 'authenticated_home',
      allowRotation: query.rotate === 'true',
    });
    if (resolved.rotatedToken) response.setHeader(SESSION_RESPONSE_HEADER, resolved.rotatedToken);
    return new OkResponseDto(
      {
        authenticated: true,
        expiresAt: resolved.expiresAt.toISOString(),
        idleExpiresAt: resolved.idleExpiresAt.toISOString(),
        remembered: resolved.remembered,
        rotationDue: resolved.rotationDue,
      },
      'Sessão válida.',
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the current session only; idempotent for the person' })
  @ApiBearerAuth(AUTHENTICATED_SESSION_BEARER)
  @ApiOkResponse({ type: LogoutResponseDto })
  async logout(@SessionBearer() token: string) {
    const result = await this.logoutSession.execute({ token });
    return new OkResponseDto(result, 'Sessão encerrada.');
  }
}
