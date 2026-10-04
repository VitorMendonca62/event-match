import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';
import { USAGE_INTENTS, type EditableProfileVisibility, type UsageIntent } from '../../../domain/entities/profile';

export class UpdateProfileDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) readonly revision!: number;
  @ApiProperty({ minLength: 1, maxLength: 60 }) @IsString() @MinLength(1) @MaxLength(60) readonly displayName!: string;
  @ApiProperty({ minLength: 2, maxLength: 80 }) @IsString() @MinLength(2) @MaxLength(80) readonly region!: string;
  @ApiProperty({ enum: USAGE_INTENTS, isArray: true }) @IsArray() @ArrayMinSize(1) @ArrayUnique() @IsEnum(USAGE_INTENTS, { each: true }) readonly usageIntents!: UsageIntent[];
  @ApiProperty({ type: [String], format: 'uuid', minItems: 3 }) @IsArray() @ArrayMinSize(3) @ArrayUnique() @IsUUID(undefined, { each: true }) readonly interestIds!: string[];
  @ApiPropertyOptional({ nullable: true, minLength: 1, maxLength: 500 }) @IsOptional() @IsString() @MinLength(1) @MaxLength(500) readonly presentation!: string | null;
  @ApiProperty({ enum: ['private', 'authenticated'] }) @IsEnum(['private', 'authenticated']) readonly photoVisibility!: EditableProfileVisibility;
  @ApiProperty({ enum: ['private', 'authenticated'] }) @IsEnum(['private', 'authenticated']) readonly presentationVisibility!: EditableProfileVisibility;
}
