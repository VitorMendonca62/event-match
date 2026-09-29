import {
  applyDecorators,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Query,
  Res,
  ServiceUnavailableException,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';

import {
  ApiResponseDto,
  BadRequestResponseDto,
  ConflictResponseDto,
  NotFoundResponseDto,
  OkResponseDto,
  UnauthorizedResponseDto,
} from '../../../../../shared/presentation/http/api-response.dto';
import { API_V1_PREFIX } from '../../../../../shared/presentation/http/api-version';
import { LocaleQueryDto } from '../../../../../shared/presentation/http/locale-query.dto';
import { CheckRegistrationEligibility } from '../../../application/use-cases/check-registration-eligibility.use-case';
import { CancelRegistration } from '../../../application/use-cases/cancel-registration.use-case';
import { ListCurrentLegalDocuments } from '../../../application/use-cases/list-current-legal-documents.use-case';
import { RegistrationFlow } from '../../../application/use-cases/registration-flow.use-case';
import { SendEmailDeliveryTest } from '../../../application/use-cases/send-email-delivery-test.use-case';
import { BffInternalGuard } from '../bff-internal.guard';
import { ContinuationGuard } from '../continuation.guard';
import {
  CompleteRegistrationRequestDto,
  ConfirmContactRequestDto,
  ConfirmLinkRequestDto,
  ContactVerificationRequestDto,
  EmailDeliveryTestRequestDto,
  EligibilityRequestDto,
  PasswordRequestDto,
  RequiredDataRequestDto,
} from '../dto/registration-request.dto';
import {
  ActivatedResponseDto,
  EmailDeliveryTestResponseDto,
  EligibilityResponseDto,
  LegalDocumentListResponseDto,
  CancelledResponseDto,
  SnapshotResponseDto,
  StageResponseDto,
  UnprocessableRegistrationResponseDto,
  VerificationWindowResponseDto,
  VerifiedResponseDto,
} from '../dto/registration-response.dto';
import { EmailDeliveryTestGuard } from '../email-delivery-test.guard';
import { RegistrationErrorFilter } from '../registration-error.filter';
import {
  BFF_TOKEN_HEADER,
  Continuation,
  CONTINUATION_RESPONSE_HEADER,
  IdempotencyKey,
  ORIGIN_FINGERPRINT_HEADER,
  OriginFingerprint,
} from '../registration-headers';

export const REGISTRATION_BEARER = 'registration-continuation';

const FICTITIOUS_TOKEN = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

/** Continuation token issued or rotated by this response; the BFF stores it as an HttpOnly cookie. */
const continuationHeader = {
  [CONTINUATION_RESPONSE_HEADER]: {
    description: 'Opaque continuation (32 bytes, base64url). Internal: removed by the BFF.',
    schema: { type: 'string', example: FICTITIOUS_TOKEN },
  },
};

function ApiIdempotencyKey(required: boolean) {
  return ApiHeader({
    name: 'Idempotency-Key',
    required,
    description: 'Client-generated key (16–128 chars of [A-Za-z0-9_-]); replays return the stored outcome.',
    example: '0192f4c4-7d1a-7b8e-9d3f-3a6c1e2b4f50',
  });
}

function RequiresContinuation() {
  return applyDecorators(UseGuards(ContinuationGuard), ApiBearerAuth(REGISTRATION_BEARER));
}

function ApiContinuationCommand() {
  return applyDecorators(
    RequiresContinuation(),
    ApiIdempotencyKey(true),
    ApiUnauthorizedResponse({ type: UnauthorizedResponseDto }),
    ApiConflictResponse({ type: ConflictResponseDto, description: 'Wrong stage or idempotency conflict.' }),
  );
}

@ApiTags('registration')
@ApiHeader({
  name: BFF_TOKEN_HEADER,
  required: true,
  description: 'Internal credential of the Next.js BFF (ADR-023). Never exposed to browsers.',
  example: 'ZmljdGljaW91cy1iZmYtdG9rZW4tZm9yLWRvY3MtMzI=',
})
@ApiBadRequestResponse({ type: BadRequestResponseDto })
@ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
@ApiNotFoundResponse({ type: NotFoundResponseDto, description: 'Routes disabled by the rollout flag.' })
@UseGuards(BffInternalGuard)
@UseFilters(RegistrationErrorFilter)
@Controller(`${API_V1_PREFIX}/registration`)
export class RegistrationController {
  constructor(
    private readonly eligibility: CheckRegistrationEligibility,
    private readonly flow: RegistrationFlow,
    private readonly cancellation: CancelRegistration,
    private readonly legalDocuments: ListCurrentLegalDocuments,
    private readonly emailDeliveryTest: SendEmailDeliveryTest,
  ) {}

  @Post('eligibility')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check age eligibility before any contact is collected (ADR-019)' })
  @ApiIdempotencyKey(false)
  @ApiOkResponse({ type: EligibilityResponseDto, headers: continuationHeader })
  @ApiUnprocessableEntityResponse({ type: UnprocessableRegistrationResponseDto })
  async checkEligibility(
    @Body() body: EligibilityRequestDto,
    @IdempotencyKey({ required: false }) _idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    // Naturally idempotent: a retry only issues another short-lived `age_eligible` session.
    const result = await this.eligibility.execute({ birthDate: body.birthDate });
    if (result.eligible) response.setHeader(CONTINUATION_RESPONSE_HEADER, result.continuation);
    return new OkResponseDto({ eligible: result.eligible }, 'Elegibilidade verificada.');
  }

  @Post('contact-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Request an e-mail verification code; neutral for every contact state' })
  @ApiContinuationCommand()
  @ApiHeader({
    name: ORIGIN_FINGERPRINT_HEADER,
    required: true,
    description: 'HMAC of the visitor origin computed by the BFF (32 bytes, base64url). Never an IP.',
    example: FICTITIOUS_TOKEN,
  })
  @ApiAcceptedResponse({ type: VerificationWindowResponseDto })
  async requestContactVerification(
    @Body() body: ContactVerificationRequestDto,
    @Continuation() token: string,
    @IdempotencyKey({ required: true }) idempotencyKey: string,
    @OriginFingerprint() originFingerprint: Buffer,
  ) {
    const { body: data } = await this.flow.requestContactVerification(
      { token, idempotencyKey },
      { contact: body.contact, originFingerprint },
    );
    return new ApiResponseDto(data, 'Se o contato puder ser usado, enviaremos um código.', HttpStatus.ACCEPTED);
  }

  @Post('email-delivery-test')
  @HttpCode(HttpStatus.OK)
  @UseGuards(EmailDeliveryTestGuard)
  @ApiOperation({ summary: 'Temporarily smoke-test the configured Brevo delivery outside production' })
  @ApiIdempotencyKey(true)
  @ApiOkResponse({ type: EmailDeliveryTestResponseDto })
  @ApiServiceUnavailableResponse({ description: 'Brevo did not accept the test message.' })
  async testEmailDelivery(
    @Body() body: EmailDeliveryTestRequestDto,
    @IdempotencyKey({ required: true }) idempotencyKey: string,
  ) {
    const result = await this.emailDeliveryTest.execute({ contact: body.contact, idempotencyKey });
    if (!result.accepted) throw new ServiceUnavailableException();
    return new OkResponseDto(
      result,
      'E-mail de teste aceito pela Brevo; o código recebido é apenas ilustrativo.',
    );
  }

  @Post('contact-verification/resend')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Resend the verification code; neutral answer' })
  @ApiContinuationCommand()
  @ApiAcceptedResponse({ type: VerificationWindowResponseDto })
  async resendContactVerification(
    @Continuation() token: string,
    @IdempotencyKey({ required: true }) idempotencyKey: string,
  ) {
    const { body: data } = await this.flow.resendContactVerification({ token, idempotencyKey });
    return new ApiResponseDto(data, 'Se houver um código pendente, enviaremos outro.', HttpStatus.ACCEPTED);
  }

  @Post('contact-verification/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm the contact with the 6-digit code' })
  @ApiContinuationCommand()
  @ApiOkResponse({ type: VerifiedResponseDto, headers: continuationHeader })
  async confirmContact(
    @Body() body: ConfirmContactRequestDto,
    @Continuation() token: string,
    @IdempotencyKey({ required: true }) idempotencyKey: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.flow.confirmContact({ token, idempotencyKey }, { otp: body.otp });
    this.handOver(response, result.continuation);
    return new OkResponseDto(result.body, 'Verificação processada.');
  }

  @Post('contact-verification/confirm-link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm the contact with the single-use e-mail link' })
  @ApiIdempotencyKey(false)
  @ApiOkResponse({ type: VerifiedResponseDto, headers: continuationHeader })
  async confirmContactByLink(
    @Body() body: ConfirmLinkRequestDto,
    @IdempotencyKey({ required: false }) _idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    // Single use by design: a retry of a consumed link answers `verified: false`.
    const result = await this.flow.confirmContactByLink({ token: body.token });
    this.handOver(response, result.continuation);
    return new OkResponseDto(result.body, 'Verificação processada.');
  }

  @Put('password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Choose the password after the contact is verified' })
  @ApiContinuationCommand()
  @ApiOkResponse({ type: StageResponseDto, headers: continuationHeader })
  @ApiUnprocessableEntityResponse({ type: UnprocessableRegistrationResponseDto })
  async choosePassword(
    @Body() body: PasswordRequestDto,
    @Continuation() token: string,
    @IdempotencyKey({ required: true }) idempotencyKey: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.flow.choosePassword({ token, idempotencyKey }, { password: body.password });
    this.handOver(response, result.continuation);
    return new OkResponseDto(result.body, 'Senha registrada.');
  }

  @Put('required-data')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save display name, region and usage intents; creates the incomplete account' })
  @ApiContinuationCommand()
  @ApiOkResponse({ type: StageResponseDto, headers: continuationHeader })
  @ApiUnprocessableEntityResponse({ type: UnprocessableRegistrationResponseDto })
  async saveRequiredData(
    @Body() body: RequiredDataRequestDto,
    @Continuation() token: string,
    @IdempotencyKey({ required: true }) idempotencyKey: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.flow.saveRequiredData({ token, idempotencyKey }, body);
    this.handOver(response, result.continuation);
    return new OkResponseDto(result.body, 'Dados obrigatórios registrados.');
  }

  @Get()
  @ApiOperation({ summary: 'Minimal snapshot to resume the journey' })
  @RequiresContinuation()
  @ApiOkResponse({ type: SnapshotResponseDto })
  async snapshot(@Continuation() token: string) {
    const snapshot = await this.flow.snapshot(token);
    return new OkResponseDto(
      {
        stage: snapshot.stage,
        expiresAt: snapshot.expiresAt.toISOString(),
        ...(snapshot.nextResendAt ? { nextResendAt: snapshot.nextResendAt.toISOString() } : {}),
      },
      'Etapa atual do cadastro.',
    );
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Give up the registration: expires it like an abandoned one and revokes the continuation' })
  @RequiresContinuation()
  @ApiOkResponse({ type: CancelledResponseDto })
  async cancel(@Continuation() token: string) {
    await this.cancellation.execute(token);
    return new OkResponseDto({ cancelled: true }, 'Cadastro cancelado.');
  }

  @Get('legal-documents')
  @ApiOperation({
    summary: 'Currently effective legal documents with their Markdown text (one version per kind)',
  })
  @ApiOkResponse({
    type: LegalDocumentListResponseDto,
    headers: { 'Cache-Control': { description: 'no-store', schema: { type: 'string' } } },
  })
  async listLegalDocuments(@Query() query: LocaleQueryDto, @Res({ passthrough: true }) response: Response) {
    const documents = await this.legalDocuments.execute({ locale: query.locale ?? 'pt-BR' });
    response.setHeader('Cache-Control', 'no-store');
    return new OkResponseDto(
      {
        documents: documents.map(({ body, effectiveAt, ...metadata }) => ({
          ...metadata,
          effectiveAt: effectiveAt.toISOString(),
          content: body,
        })),
      },
      'Documentos vigentes.',
    );
  }

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept documents, choose interests and activate the account' })
  @ApiContinuationCommand()
  @ApiOkResponse({ type: ActivatedResponseDto })
  @ApiUnprocessableEntityResponse({ type: UnprocessableRegistrationResponseDto })
  async complete(
    @Body() body: CompleteRegistrationRequestDto,
    @Continuation() token: string,
    @IdempotencyKey({ required: true }) idempotencyKey: string,
  ) {
    const result = await this.flow.complete({ token, idempotencyKey }, body);
    return new OkResponseDto(result.body, 'Cadastro concluído.');
  }

  private handOver(response: Response, continuation: string | null): void {
    if (continuation) response.setHeader(CONTINUATION_RESPONSE_HEADER, continuation);
  }
}
