import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsDefined, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PRONOUN_SELECTIONS, USAGE_INTENTS, type EditableProfileVisibility, type PronounSelection, type UsageIntent } from '../../../domain/entities/profile';
import { AVAILABILITY_SLOTS, PREFERRED_DISTANCES, type AvailabilitySlot, type PreferredDistance } from '../../../domain/value-objects/availability';
import { SOCIAL_PROVIDERS, type EditableSocialLinkVisibility, type SocialProvider } from '../../../domain/value-objects/social-link';
import { FEDERATIVE_UNIT_CODES } from '../../../../catalog/domain/value-objects/location';

export class UpdateSocialLinkDto {
  @ApiProperty({ format: 'uuid', required: false }) @IsOptional() @IsUUID() readonly id?: string;
  @ApiProperty({ enum: SOCIAL_PROVIDERS }) @IsEnum(SOCIAL_PROVIDERS) readonly provider!: SocialProvider;
  @ApiProperty({ minLength: 1, maxLength: 200, description: 'Handle or HTTPS profile URL; only the canonical identifier is persisted.' }) @IsString() @MinLength(1) @MaxLength(200) readonly identifierOrUrl!: string;
  @ApiProperty({ minimum: 1, maximum: 3 }) @IsInt() @Min(1) @Max(3) readonly position!: number;
  @ApiProperty({ enum: ['private', 'authenticated'] }) @IsEnum(['private', 'authenticated']) readonly visibility!: EditableSocialLinkVisibility;
}

export class UpdateProfileDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) readonly revision!: number;
  @ApiProperty({ minLength: 1, maxLength: 60 }) @IsString() @MinLength(1) @MaxLength(60) readonly displayName!: string;
  @ApiProperty({ enum: FEDERATIVE_UNIT_CODES, example: 'PE' }) @IsEnum(FEDERATIVE_UNIT_CODES) readonly ufCode!: string;
  @ApiProperty({ pattern: '^\\d{7}$', example: '2611606' }) @IsString() @Matches(/^\d{7}$/u) readonly municipalityCode!: string;
  @ApiProperty({ enum: USAGE_INTENTS, isArray: true }) @IsArray() @ArrayMinSize(1) @ArrayUnique() @IsEnum(USAGE_INTENTS, { each: true }) readonly usageIntents!: UsageIntent[];
  @ApiProperty({ type: [String], format: 'uuid', minItems: 3 }) @IsArray() @ArrayMinSize(3) @ArrayUnique() @IsUUID(undefined, { each: true }) readonly interestIds!: string[];
  @ApiProperty({ nullable: true, minLength: 1, maxLength: 500 }) @ValidateIf((_object, value) => value !== null) @IsDefined() @IsString() @MinLength(1) @MaxLength(500) readonly presentation!: string | null;
  @ApiProperty({ enum: ['private', 'authenticated'] }) @IsEnum(['private', 'authenticated']) readonly photoVisibility!: EditableProfileVisibility;
  @ApiProperty({ enum: ['private', 'authenticated'] }) @IsEnum(['private', 'authenticated']) readonly presentationVisibility!: EditableProfileVisibility;
  @ApiProperty({ enum: PRONOUN_SELECTIONS, nullable: true }) @ValidateIf((_object, value) => value !== null) @IsDefined() @IsEnum(PRONOUN_SELECTIONS) readonly pronounSelection!: PronounSelection | null;
  @ApiProperty({ nullable: true, maxLength: 40 }) @ValidateIf((_object, value) => value !== null) @IsDefined() @IsString() @MinLength(1) @MaxLength(40) readonly customPronouns!: string | null;
  @ApiProperty({ enum: ['private', 'authenticated'] }) @IsEnum(['private', 'authenticated']) readonly pronounsVisibility!: EditableProfileVisibility;
  @ApiProperty({ nullable: true, maxLength: 80 }) @ValidateIf((_object, value) => value !== null) @IsDefined() @IsString() @MinLength(1) @MaxLength(80) readonly profession!: string | null;
  @ApiProperty({ enum: ['private', 'authenticated'] }) @IsEnum(['private', 'authenticated']) readonly professionVisibility!: EditableProfileVisibility;
  @ApiProperty({ type: [String], maxItems: 5 }) @IsArray() @ArrayMaxSize(5) @ArrayUnique() @Matches(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/, { each: true }) readonly languageCodes!: string[];
  @ApiProperty({ enum: ['private', 'authenticated'] }) @IsEnum(['private', 'authenticated']) readonly languagesVisibility!: EditableProfileVisibility;
  @ApiProperty({ type: [String], maxItems: 5, uniqueItems: true, pattern: '^[a-z][a-z0-9_]{1,39}$' }) @IsArray() @ArrayMaxSize(5) @ArrayUnique() @Matches(/^[a-z][a-z0-9_]{1,39}$/, { each: true }) readonly activityPreferenceCodes!: string[];
  @ApiProperty({ enum: ['private', 'authenticated'] }) @IsEnum(['private', 'authenticated']) readonly activityPreferencesVisibility!: EditableProfileVisibility;
  @ApiProperty({ enum: AVAILABILITY_SLOTS, isArray: true, maxItems: 28, uniqueItems: true }) @IsDefined() @IsArray() @ArrayMaxSize(28) @ArrayUnique() @IsIn(AVAILABILITY_SLOTS, { each: true }) readonly availabilitySlots!: AvailabilitySlot[];
  @ApiProperty({ enum: PREFERRED_DISTANCES, nullable: true }) @ValidateIf((_object, value) => value !== null) @IsDefined() @IsIn(PREFERRED_DISTANCES) readonly preferredDistance!: PreferredDistance | null;
  @ApiProperty({ type: [UpdateSocialLinkDto], maxItems: 3, uniqueItems: true }) @IsDefined() @IsArray() @ArrayMaxSize(3) @ValidateNested({ each: true }) @Type(() => UpdateSocialLinkDto) readonly socialLinks!: UpdateSocialLinkDto[];
}
