import { HttpStatus } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { apiEnvelope } from '../../../../../shared/presentation/http/api-envelope';

export class ProfilePhotoRevisionDto { @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) readonly revision!: number; }

export class CloudinaryUploadResponseDto {
  @ApiProperty() @IsString() readonly asset_id!: string;
  @ApiProperty() @IsString() readonly public_id!: string;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) readonly version!: number;
  @ApiProperty() @IsString() readonly signature!: string;
  @ApiProperty({ enum: ['jpg', 'png', 'webp'] }) @IsIn(['jpg', 'png', 'webp']) readonly format!: 'jpg' | 'png' | 'webp';
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) readonly bytes!: number;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) readonly width!: number;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) readonly height!: number;
}

export class FinalizeProfilePhotoDto extends ProfilePhotoRevisionDto {
  @ApiProperty({ type: CloudinaryUploadResponseDto, additionalProperties: false })
  @ValidateNested()
  @Type(() => CloudinaryUploadResponseDto)
  readonly providerResponse!: CloudinaryUploadResponseDto;
}

export class SignedProfilePhotoUploadGrantDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() uploadId!: string;
  @ApiProperty({ format: 'uri' }) uploadUrl!: string;
  @ApiProperty() cloudName!: string;
  @ApiProperty() apiKey!: string;
  @ApiProperty() publicId!: string;
  @ApiProperty() timestamp!: number;
  @ApiProperty({ format: 'date-time' }) expiresAt!: Date;
  @ApiProperty() uploadPreset!: string;
  @ApiProperty() signature!: string;
}

export const SignedProfilePhotoUploadGrantEnvelopeDto = apiEnvelope(
  SignedProfilePhotoUploadGrantDto,
  'SignedProfilePhotoUploadGrantEnvelopeDto',
  HttpStatus.CREATED,
);
