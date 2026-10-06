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
export class ProfileLanguageDto { @ApiProperty({ example: 'pt' }) code!: string; @ApiProperty({ example: 'Português' }) label!: string; @ApiProperty() active!: boolean; }
export class PreviewLanguageDto { @ApiProperty({ example: 'pt' }) code!: string; @ApiProperty({ example: 'Português' }) label!: string; }
export class OwnProfileResponseDto {
  @ApiProperty() revision!: number;
  @ApiProperty() displayName!: string;
  @ApiProperty() region!: string;
  @ApiProperty({ type: [String] }) usageIntents!: string[];
  @ApiProperty({ type: [ProfileInterestDto] }) interests!: ProfileInterestDto[];
  @ApiProperty({ nullable: true }) presentation!: string | null;
  @ApiProperty({ enum: ['private', 'authenticated', 'public'] }) photoVisibility!: string;
  @ApiProperty({ enum: ['private', 'authenticated', 'public'] }) presentationVisibility!: string;
  @ApiProperty({ type: ProfilePhotoResponseDto, nullable: true }) photo!: ProfilePhotoResponseDto | null;
  @ApiProperty({ type: ProfileCompletionDto }) completion!: ProfileCompletionDto;
  @ApiProperty({ enum: ['ela_dela', 'ele_dele', 'elu_delu', 'other', 'prefer_not_to_say'], nullable: true }) pronounSelection!: string | null;
  @ApiProperty({ nullable: true }) customPronouns!: string | null;
  @ApiProperty({ enum: ['private', 'authenticated', 'public'] }) pronounsVisibility!: string;
  @ApiProperty({ nullable: true }) profession!: string | null;
  @ApiProperty({ enum: ['private', 'authenticated', 'public'] }) professionVisibility!: string;
  @ApiProperty({ type: [ProfileLanguageDto] }) languages!: ProfileLanguageDto[];
  @ApiProperty({ enum: ['private', 'authenticated', 'public'] }) languagesVisibility!: string;
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
  @ApiPropertyOptional() pronouns?: string;
  @ApiPropertyOptional() profession?: string;
  @ApiPropertyOptional({ type: [PreviewLanguageDto] }) languages?: PreviewLanguageDto[];
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
