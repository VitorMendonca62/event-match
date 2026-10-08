import { z } from 'zod';

export const FEDERATIVE_UNIT_CODES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export const ufCodeSchema = z.enum(FEDERATIVE_UNIT_CODES);
export const federativeUnitSchema = z.strictObject({ code: ufCodeSchema, name: z.string().min(1) });
export const federativeUnitListDataSchema = z.strictObject({ federativeUnits: z.array(federativeUnitSchema) });
export const municipalitySchema = z.strictObject({
  code: z.string().regex(/^\d{7}$/),
  name: z.string().min(1),
  ufCode: ufCodeSchema,
});
export const municipalityListDataSchema = z.strictObject({ municipalities: z.array(municipalitySchema).max(20) });
export const structuredLocationSchema = z.strictObject({
  ufCode: ufCodeSchema,
  municipalityCode: z.string().regex(/^\d{7}$/),
  municipalityName: z.string().min(1),
});

export type UfCode = z.infer<typeof ufCodeSchema>;
export type FederativeUnitOption = z.infer<typeof federativeUnitSchema>;
export type MunicipalityOption = z.infer<typeof municipalitySchema>;
export type StructuredLocation = z.infer<typeof structuredLocationSchema>;
