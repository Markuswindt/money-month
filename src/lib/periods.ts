import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear,
  addWeeks, addMonths, addYears, format, getISOWeek, isSameMonth, isSameYear,
} from 'date-fns';
import { de } from 'date-fns/locale';

export type PeriodType = 'week' | 'month' | 'year';

export const PERIOD_TYPES: readonly PeriodType[] = ['week', 'month', 'year'];

export type Period = {
  type: PeriodType;
  start: Date;
  end: Date;
  /** Grenzen als 'YYYY-MM-DD', beide inklusive.
   *
   *  Ausgaben speichern ihr Datum als Kalendertag-String, nicht als Zeitpunkt.
   *  Der Vergleich laeuft deshalb ueber Strings statt ueber Date-Objekte:
   *  lexikografisch identisch mit chronologisch, und ohne jede Chance auf
   *  einen Zeitzonen-Versatz, der einen Eintrag in den Nachbarmonat schiebt. */
  startIso: string;
  endIso: string;
  /** Stabiler Schluessel fuer React-Listen und Chart-Achsen. */
  key: string;
};

const WEEK_OPTIONS = { weekStartsOn: 1 } as const; // Montag

/** Kalendertag als 'YYYY-MM-DD' in LOKALER Zeit.
 *  toISOString() waere falsch: das rechnet nach UTC um und macht aus dem
 *  1. Oktober 00:30 deutscher Zeit den 30. September. */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 'YYYY-MM-DD' zu einem lokalen Date (Mitternacht). */
export function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

function boundsFor(type: PeriodType, ref: Date): { start: Date; end: Date } {
  switch (type) {
    case 'week':
      return { start: startOfWeek(ref, WEEK_OPTIONS), end: endOfWeek(ref, WEEK_OPTIONS) };
    case 'month':
      return { start: startOfMonth(ref), end: endOfMonth(ref) };
    case 'year':
      return { start: startOfYear(ref), end: endOfYear(ref) };
  }
}

export function makePeriod(type: PeriodType, ref: Date = new Date()): Period {
  const { start, end } = boundsFor(type, ref);
  const startIso = toIsoDate(start);
  return {
    type,
    start,
    end,
    startIso,
    endIso: toIsoDate(end),
    key: `${type}:${startIso}`,
  };
}

/** Verschiebt um `delta` Perioden (negativ = zurueck). */
export function shiftPeriod(period: Period, delta: number): Period {
  const ref =
    period.type === 'week' ? addWeeks(period.start, delta)
    : period.type === 'month' ? addMonths(period.start, delta)
    : addYears(period.start, delta);
  return makePeriod(period.type, ref);
}

/** Wechselt den Typ, bleibt aber am selben Zeitpunkt.
 *  Vom September in die Wochenansicht zu wechseln landet in einer
 *  September-Woche - nicht in der aktuellen Kalenderwoche. */
export function changePeriodType(period: Period, type: PeriodType): Period {
  const today = new Date();
  // Enthaelt die Periode heute, bleiben wir bei heute - sonst springt die
  // Wochenansicht auf den 1. des Monats statt auf die laufende Woche.
  const ref = containsIso(period, toIsoDate(today)) ? today : period.start;
  return makePeriod(type, ref);
}

export function containsIso(period: Period, iso: string): boolean {
  return iso >= period.startIso && iso <= period.endIso;
}

export function isCurrentPeriod(period: Period): boolean {
  return containsIso(period, todayIso());
}

/** Die `count` Perioden bis einschliesslich `period`, chronologisch.
 *  Grundlage des Trend-Charts. */
export function lastPeriods(period: Period, count: number): Period[] {
  const out: Period[] = [];
  for (let i = count - 1; i >= 0; i--) out.push(shiftPeriod(period, -i));
  return out;
}

/** Wie viele Perioden das Trend-Chart je Typ zeigt. */
export const TREND_LENGTH: Record<PeriodType, number> = {
  week: 8,
  month: 6,
  year: 5,
};

export function periodLabel(period: Period): string {
  switch (period.type) {
    case 'week': {
      const sameMonth = isSameMonth(period.start, period.end);
      const from = format(period.start, sameMonth ? 'd.' : 'd. MMM', { locale: de });
      const to = format(period.end, 'd. MMM', { locale: de });
      return `KW ${getISOWeek(period.start)} · ${from}–${to}`;
    }
    case 'month':
      return format(period.start, 'MMMM yyyy', { locale: de });
    case 'year':
      return format(period.start, 'yyyy', { locale: de });
  }
}

/** Kurzform fuer Chart-Achsen: "KW 38", "Sep", "2026". */
export function periodShortLabel(period: Period): string {
  switch (period.type) {
    case 'week':
      return `KW ${getISOWeek(period.start)}`;
    case 'month':
      return format(period.start, 'MMM', { locale: de });
    case 'year':
      return format(period.start, 'yyyy', { locale: de });
  }
}

/** Name der Vorperiode fuer den Vergleichssatz ("+12 % ggü. August"). */
export function previousPeriodLabel(period: Period): string {
  const prev = shiftPeriod(period, -1);
  switch (period.type) {
    case 'week':
      return `KW ${getISOWeek(prev.start)}`;
    case 'month':
      return isSameYear(prev.start, period.start)
        ? format(prev.start, 'MMMM', { locale: de })
        : format(prev.start, 'MMMM yyyy', { locale: de });
    case 'year':
      return format(prev.start, 'yyyy', { locale: de });
  }
}

export const PERIOD_LABELS: Record<PeriodType, string> = {
  week: 'Woche',
  month: 'Monat',
  year: 'Jahr',
};

/** "pro Monat" usw. - fuer Fixkosten-Durchschnitte. */
export const PERIOD_UNIT_LABELS: Record<PeriodType, string> = {
  week: 'pro Woche',
  month: 'pro Monat',
  year: 'pro Jahr',
};

/** Tagesdatum in Listen: "Heute", "Gestern", sonst "Mi, 17. Sep". */
export function formatDayLabel(iso: string, today: string = todayIso()): string {
  if (iso === today) return 'Heute';
  const yesterday = toIsoDate(new Date(fromIsoDate(today).getTime() - 86_400_000));
  if (iso === yesterday) return 'Gestern';
  return format(fromIsoDate(iso), 'EEEEEE, d. MMM', { locale: de });
}

export function formatFullDate(iso: string): string {
  return format(fromIsoDate(iso), 'd. MMMM yyyy', { locale: de });
}
