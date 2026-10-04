import { HttpStatus } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { apiEnvelope } from '../../../../../shared/presentation/http/api-envelope';

export class ProfileCompletionDto {
  @ApiProperty() complete!: boolean;
  @ApiProperty() completedCount!: number;
  @ApiProperty({ example: 6 }) totalCount!: 6;
  @ApiProperty({ type: [String] }) missing!: string[];
}
export class ProfileInterestDto { @ApiProperty() id!: string; @ApiProperty() slug!: string; @ApiProperty() label!: string; }
export class ProfilePhotoResponseDto {
  @ApiProperty({ format: 'uri' }) deliveryUrl!: string;
  @ApiProperty({ example: 512 }) width!: 512;
  @ApiProperty({ example: 512 }) height!: 512;
}
export class OwnProfileResponseDto {
  @ApiProperty() revision!: number;
  @ApiProperty() displayName!: string;
  @ApiProperty() region!: string;
  @ApiProperty({ type: [String] }) usageIntents!: string[];
  @ApiProperty({ type: [ProfileInterestDto] }) interests!: ProfileInterestDto[];
  @ApiPropertyOptional({ nullable: true }) presentation!: string | null;
  @ApiProperty({ enum: ['private', 'authenticated', 'public'] }) photoVisibility!: string;
  @ApiProperty({ enum: ['private', 'authenticated', 'public'] }) presentationVisibility!: string;
  @ApiPropertyOptional({ type: ProfilePhotoResponseDto, nullable: true }) photo!: ProfilePhotoResponseDto | null;
  @ApiProperty({ type: ProfileCompletionDto }) completion!: ProfileCompletionDto;
}
export class InternalOwnProfileResponseDto extends OwnProfileResponseDto {
  @ApiProperty({ example: `v1.${'A'.repeat(43)}` }) invitationSubject!: string;
}
export class ProfilePreviewResponseDto {
  @ApiProperty() displayName!: string;
  @ApiProperty() region!: string;
  @ApiProperty({ type: [String] }) usageIntents!: string[];
  @ApiProperty({ type: [ProfileInterestDto] }) interests!: ProfileInterestDto[];
  @ApiPropertyOptional() presentation?: string;
  @ApiPropertyOptional({ type: ProfilePhotoResponseDto }) photo?: ProfilePhotoResponseDto;
}

export const OwnProfileEnvelopeDto = apiEnvelope(
  OwnProfileResponseDto,
  'OwnProfileEnvelopeDto',
  HttpStatus.OK,
);
export const InternalOwnProfileEnvelopeDto = apiEnvelope(
  InternalOwnProfileResponseDto,
  'InternalOwnProfileEnvelopeDto',
  HttpStatus.OK,
);
export const ProfilePreviewEnvelopeDto = apiEnvelope(
  ProfilePreviewResponseDto,
  'ProfilePreviewEnvelopeDto',
  HttpStatus.OK,
);
