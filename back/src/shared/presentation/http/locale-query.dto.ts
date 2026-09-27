import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

/** Labels are authored in pt-BR only; other locales are an additive change. */
export const SUPPORTED_LOCALES = ['pt-BR'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** `?locale=` shared by public read endpoints of every bounded context. */
export class LocaleQueryDto {
  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES, default: 'pt-BR' })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  readonly locale?: SupportedLocale;
}
