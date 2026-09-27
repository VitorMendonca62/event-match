import { HttpStatus } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { apiEnvelope } from '../../../../../shared/presentation/http/api-envelope';
import { FLOW_STAGES, type FlowStage } from '../../../domain/entities/registration-flow-session';
import { REQUIRED_TERMS_KINDS, type TermsDocumentKind } from '../../../domain/value-objects/terms-document-kind';

export class EligibilityDto {
  @ApiProperty({ example: true })
  readonly eligible!: boolean;
}

export class VerificationWindowDto {
  @ApiProperty({ format: 'date-time' })
  readonly expiresAt!: string;

  @ApiProperty({ format: 'date-time' })
  readonly nextResendAt!: string;
}

export class VerifiedDto {
  @ApiProperty({ example: true })
  readonly verified!: boolean;
}

export class EmailDeliveryTestDto {
  @ApiProperty({ example: true })
  readonly accepted!: boolean;
}

export class StageDto {
  @ApiProperty({ enum: FLOW_STAGES })
  readonly stage!: FlowStage;

  @ApiProperty({ format: 'date-time' })
  readonly expiresAt!: string;
}

export class SnapshotDto extends StageDto {
  @ApiPropertyOptional({ format: 'date-time' })
  readonly nextResendAt?: string;
}

export class LegalDocumentDto {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ enum: REQUIRED_TERMS_KINDS })
  readonly kind!: TermsDocumentKind;

  @ApiProperty({ example: '2026-10-01' })
  readonly version!: string;

  @ApiProperty({ example: 'pt-BR' })
  readonly locale!: string;

  @ApiProperty({ format: 'date-time' })
  readonly effectiveAt!: string;
}

export class LegalDocumentListDto {
  @ApiProperty({ type: [LegalDocumentDto] })
  readonly documents!: LegalDocumentDto[];
}

export class ActivatedDto {
  @ApiProperty({ enum: ['active'] })
  readonly status!: 'active';
}

export class ErrorReasonDto {
  @ApiPropertyOptional({
    enum: [
      'invalid_contact',
      'invalid_password',
      'weak_password',
      'invalid_birth_date',
      'invalid_display_name',
      'invalid_region',
      'invalid_usage_intents',
      'activation_unavailable',
    ],
  })
  readonly reason?: string;
}

export const EligibilityResponseDto = apiEnvelope(EligibilityDto, 'EligibilityResponseDto', HttpStatus.OK);
export const VerificationWindowResponseDto = apiEnvelope(
  VerificationWindowDto,
  'VerificationWindowResponseDto',
  HttpStatus.ACCEPTED,
);
export const VerifiedResponseDto = apiEnvelope(VerifiedDto, 'VerifiedResponseDto', HttpStatus.OK);
export const EmailDeliveryTestResponseDto = apiEnvelope(
  EmailDeliveryTestDto,
  'EmailDeliveryTestResponseDto',
  HttpStatus.OK,
);
export const StageResponseDto = apiEnvelope(StageDto, 'StageResponseDto', HttpStatus.OK);
export const SnapshotResponseDto = apiEnvelope(SnapshotDto, 'SnapshotResponseDto', HttpStatus.OK);
export const LegalDocumentListResponseDto = apiEnvelope(
  LegalDocumentListDto,
  'LegalDocumentListResponseDto',
  HttpStatus.OK,
);
export const ActivatedResponseDto = apiEnvelope(ActivatedDto, 'ActivatedResponseDto', HttpStatus.OK);
export const UnprocessableRegistrationResponseDto = apiEnvelope(
  ErrorReasonDto,
  'UnprocessableRegistrationResponseDto',
  HttpStatus.UNPROCESSABLE_ENTITY,
);
