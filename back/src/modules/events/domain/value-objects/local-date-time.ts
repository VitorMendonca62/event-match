import { EventError } from '../errors/event.error';

type LocalParts = Readonly<{ year: number; month: number; day: number; hour: number; minute: number; second: number }>;

const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/u;

export function normalizeLocalDateTime(value: string): string {
  const parts = parseLocalDateTime(value);
  return `${parts.year.toString().padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}${parts.second === 0 && !value.includes(':', 16) ? '' : `:${String(parts.second).padStart(2, '0')}`}`;
}

export function parseLocalDateTime(value: string): LocalParts {
  const match = LOCAL_DATE_TIME.exec(value);
  if (!match) throw new EventError('INVALID_DATE_TIME', 'invalid_date_time');
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText ?? '0');
  const calendar = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day ||
    calendar.getUTCHours() !== hour || calendar.getUTCMinutes() !== minute || calendar.getUTCSeconds() !== second
  ) throw new EventError('INVALID_DATE_TIME', 'invalid_date_time');
  return { year, month, day, hour, minute, second };
}

function partsInTimeZone(date: Date, timeZone: string): LocalParts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const values = Object.fromEntries(formatter.formatToParts(date).filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, Number(value)]));
  return { year: values.year, month: values.month, day: values.day, hour: values.hour, minute: values.minute, second: values.second };
}

function sameParts(left: LocalParts, right: LocalParts): boolean {
  return left.year === right.year && left.month === right.month && left.day === right.day && left.hour === right.hour && left.minute === right.minute && left.second === right.second;
}

/** Resolves local wall time without accepting nonexistent or ambiguous DST times. */
export function resolveLocalDateTime(value: string, timeZone: string): Date {
  const target = parseLocalDateTime(value);
  try {
    const naiveUtc = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute, target.second);
    const candidates: number[] = [];
    for (let offsetMinutes = -14 * 60; offsetMinutes <= 14 * 60; offsetMinutes += 1) {
      const candidate = new Date(naiveUtc - offsetMinutes * 60_000);
      if (sameParts(partsInTimeZone(candidate, timeZone), target)) candidates.push(candidate.getTime());
    }
    if (candidates.length !== 1) throw new EventError('INVALID_DATE_TIME', 'invalid_date_time');
    return new Date(candidates[0]);
  } catch (error) {
    if (error instanceof EventError) throw error;
    throw new EventError('INVALID_DATE_TIME', 'invalid_date_time');
  }
}

export function isLocalDateTime(value: string): boolean {
  try { parseLocalDateTime(value); return true; } catch { return false; }
}
