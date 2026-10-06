import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsDefined, IsEnum, IsInt, IsString, IsUUID, Matches, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { PRONOUN_SELECTIONS, USAGE_INTENTS, type EditableProfileVisibility, type PronounSelection, type UsageIntent } from '../../../domain/entities/profile';

export class UpdateProfileDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) readonly revision!: number;
  @ApiProperty({ minLength: 1, maxLength: 60 }) @IsString() @MinLength(1) @MaxLength(60) readonly displayName!: string;
  @ApiProperty({ minLength: 2, maxLength: 80 }) @IsString() @MinLength(2) @MaxLength(80) readonly region!: string;
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
}
