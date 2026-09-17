import { addDays, addMonths, differenceInCalendarDays, getDay, getDaysInMonth, setDate } from 'date-fns';
import type { FixedExpense, RecurrenceInterval } from '@/data/schema';
import { fromIsoDate, toIsoDate, type Period, type PeriodType } from './periods';

/**
 * AMORTISIERUNG
 *
 * Kanonisch ist der Monatsbetrag. Bewusst 12 Monate und 52 Wochen statt
 * kalendergenauer 365,25 Tage: so ist die Umrechnung rundreise-stabil
 * (10 €/Woche -> 43,33 €/Monat -> 520 €/Jahr -> 10 €/Woche) und laesst sich
 * in einem Satz erklaeren. Kalendergenauigkeit brächte hier dritte
 * Nachkommastellen und keinen Erkenntnisgewinn.
 */
export const MONTHLY_FACTOR: Record<RecurrenceInterval, number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  semiannual: 1 / 6,
  yearly: 1 / 12,
};

const PERIOD_FACTOR: Record<PeriodType, number> = {
  week: 12 / 52,
  month: 1,
  year: 12,
};

/** Monatlicher Durchschnitt in Cent. Bewusst als Fliesskommazahl -
 *  gerundet wird erst bei der Anzeige, sonst driften Summen auseinander. */
export function monthlyCents(fixed: Pick<FixedExpense, 'amountCents' | 'interval'>): number {
  return fixed.amountCents * MONTHLY_FACTOR[fixed.interval];
}

/** Der volle Periodenbetrag, ohne Beruecksichtigung von Start- und Enddatum. */
export function fullPeriodCents(
  fixed: Pick<FixedExpense, 'amountCents' | 'interval'>,
  periodType: PeriodType,
): number {
  return monthlyCents(fixed) * PERIOD_FACTOR[periodType];
}

/** Laeuft die Fixkostenposition in dieser Periode ueberhaupt? */
export function isActiveInPeriod(fixed: FixedExpense, period: Period): boolean {
  if (fixed.deletedAt !== null) return false;
  if (fixed.startDate > period.endIso) return false;
  if (fixed.endDate !== null && fixed.endDate < period.startIso) return false;
  return true;
}

/**
 * Anteil der Periode, den die Position tatsaechlich abdeckt (0..1).
 *
 * Ohne das zeigt die Jahresansicht 12 Monatsmieten an, auch wenn die Miete
 * erst im Juli begonnen hat. Fuer den Normalfall - laeuft seit Jahren, kein
 * Enddatum - ist das Ergebnis exakt 1, der haeufige Fall bleibt also
 * unveraendert und rund.
 */
export function coverage(fixed: FixedExpense, period: Period): number {
  if (!isActiveInPeriod(fixed, period)) return 0;

  const from = fixed.startDate > period.startIso ? fixed.startDate : period.startIso;
  const to =
    fixed.endDate !== null && fixed.endDate < period.endIso ? fixed.endDate : period.endIso;
  if (from > to) return 0;

  const periodDays = differenceInCalendarDays(period.end, period.start) + 1;
  const activeDays = differenceInCalendarDays(fromIsoDate(to), fromIsoDate(from)) + 1;
  return periodDays === 0 ? 0 : activeDays / periodDays;
}

/** Was diese Fixkostenposition in dieser Periode beitraegt, in Cent. */
export function amountInPeriod(fixed: FixedExpense, period: Period): number {
  return fullPeriodCents(fixed, period.type) * coverage(fixed, period);
}

const INTERVAL_MONTHS: Partial<Record<RecurrenceInterval, number>> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
};

const INTERVAL_DAYS: Partial<Record<RecurrenceInterval, number>> = {
  weekly: 7,
  biweekly: 14,
};

/** date-fns liefert Sonntag = 0; wir speichern Montag = 1 .. Sonntag = 7. */
function isoWeekday(date: Date): number {
  const d = getDay(date);
  return d === 0 ? 7 : d;
}

/** Legt den Abbuchungstag auf einen Monat, ohne ueberzulaufen.
 *  Der 31. wird im November zum 30., nicht zum 1. Dezember. */
function clampToMonth(monthRef: Date, day: number): Date {
  return setDate(monthRef, Math.min(day, getDaysInMonth(monthRef)));
}

/**
 * Naechste Faelligkeit ab `fromIso` (einschliesslich), oder null, wenn die
 * Position vorher endet.
 */
export function nextDueDate(fixed: FixedExpense, fromIso: string): string | null {
  const from = fromIsoDate(fromIso < fixed.startDate ? fixed.startDate : fromIso);
  const start = fromIsoDate(fixed.startDate);

  const dayStep = INTERVAL_DAYS[fixed.interval];
  if (dayStep !== undefined) {
    // Woechentlich / 2-woechentlich: dueDay ist der Wochentag.
    let cursor = start;
    // Erste Faelligkeit: ab Startdatum zum gewuenschten Wochentag vorruecken.
    const offset = (fixed.dueDay - isoWeekday(cursor) + 7) % 7;
    cursor = addDays(cursor, offset);
    // Dann in Intervallschritten bis zum gesuchten Zeitpunkt.
    while (cursor < from) cursor = addDays(cursor, dayStep);
    const iso = toIsoDate(cursor);
    return fixed.endDate !== null && iso > fixed.endDate ? null : iso;
  }

  const monthStep = INTERVAL_MONTHS[fixed.interval] ?? 1;
  let cursor = clampToMonth(start, fixed.dueDay);
  // Faellt der Abbuchungstag im Startmonat schon vor das Startdatum,
  // ist die erste Faelligkeit einen Schritt spaeter.
  if (toIsoDate(cursor) < fixed.startDate) {
    cursor = clampToMonth(addMonths(start, monthStep), fixed.dueDay);
  }
  let guard = 0;
  while (toIsoDate(cursor) < toIsoDate(from) && guard++ < 1200) {
    cursor = clampToMonth(addMonths(cursor, monthStep), fixed.dueDay);
  }
  const iso = toIsoDate(cursor);
  return fixed.endDate !== null && iso > fixed.endDate ? null : iso;
}

/** Alle Faelligkeiten in einem Zeitfenster, chronologisch.
 *  Grundlage der Timeline "Nächste Abbuchungen". */
export function dueDatesBetween(fixed: FixedExpense, fromIso: string, toIso: string): string[] {
  const out: string[] = [];
  let cursor = fromIso;
  let guard = 0;
  while (guard++ < 400) {
    const next = nextDueDate(fixed, cursor);
    if (next === null || next > toIso) break;
    out.push(next);
    cursor = toIsoDate(addDays(fromIsoDate(next), 1));
  }
  return out;
}
