export const FEDERATIVE_UNIT_CODES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export type UfCode = (typeof FEDERATIVE_UNIT_CODES)[number];

export type StructuredLocation = Readonly<{
  ufCode: UfCode;
  municipalityCode: string;
  municipalityName: string;
}>;

export function isUfCode(value: string): value is UfCode {
  return (FEDERATIVE_UNIT_CODES as readonly string[]).includes(value);
}

export function isIbgeMunicipalityCode(value: string): boolean {
  return /^\d{7}$/u.test(value);
}
