import type { FixedExpense, VariableExpense } from '@/data/schema';
import { amountInPeriod, isActiveInPeriod } from './recurrence';
import {
  containsIso, fromIsoDate, lastPeriods, makePeriod, shiftPeriod, toIsoDate,
  TREND_LENGTH, type Period, type PeriodType,
} from './periods';

export type ExpenseFilter = 'all' | 'variable' | 'fixed';

export const FILTER_LABELS: Record<ExpenseFilter, string> = {
  all: 'Alle',
  variable: 'Nur variabel',
  fixed: 'Nur fix',
};

export type Dataset = {
  variable: readonly VariableExpense[];
  fixed: readonly FixedExpense[];
};

export type PeriodTotals = {
  fixedCents: number;
  variableCents: number;
  totalCents: number;
};

export type CategoryRow = {
  categoryId: string;
  cents: number;
  /** Anteil an der Gesamtsumme in Prozent (0-100). */
  share: number;
};

export type TrendPoint = {
  period: Period;
  fixedCents: number;
  variableCents: number;
  totalCents: number;
};

/**
 * Verteilt Rundungsdifferenzen nach dem Verfahren des groessten Rests.
 *
 * Ohne das summieren sich die einzeln gerundeten Kategoriezeilen auf einen
 * anderen Wert als die gerundete Gesamtsumme - sichtbar als Zeile, die
 * einen Cent danebenliegt. Genau dort verliert eine Finanz-App ihr
 * Vertrauen, auch wenn der Fehler winzig ist.
 */
export function distributeRounding(parts: readonly number[], target: number): number[] {
  if (parts.length === 0) return [];
  const floors = parts.map((p) => Math.floor(p));
  const sumFloors = floors.reduce((a, b) => a + b, 0);
  let diff = target - sumFloors;

  const byRemainder = parts
    .map((p, i) => ({ i, frac: p - Math.floor(p) }))
    .sort((a, b) => b.frac - a.frac);

  const out = [...floors];
  // Zu wenig verteilt: die groessten Reste bekommen je einen Cent dazu.
  for (let k = 0; diff > 0 && k < byRemainder.length; k++, diff--) {
    const idx = byRemainder[k]?.i;
    if (idx !== undefined) out[idx] = (out[idx] ?? 0) + 1;
  }
  // Zu viel verteilt (moeglich bei negativen Werten): kleinste Reste zuerst.
  for (let k = byRemainder.length - 1; diff < 0 && k >= 0; k--, diff++) {
    const idx = byRemainder[k]?.i;
    if (idx !== undefined) out[idx] = (out[idx] ?? 0) - 1;
  }
  return out;
}

/** Notbremse gegen ein verrutschtes Datum im Import: ohne sie wuerde eine
 *  Ausgabe mit Jahr 1015 rund 12.000 Monatskandidaten erzeugen. */
const MAX_CANDIDATES = 2000;

/**
 * Perioden des Typs, in denen es ueberhaupt etwas zu sehen gibt.
 *
 * Grundlage des Auswahlstreifens. Ein fester Ruecklauf ueber 36 Monate
 * zeigte dort Zeitraeume, in denen nie etwas erfasst wurde - man scrollte
 * durch leere Monate, bevor die eigenen Daten anfingen.
 *
 * Was als "Daten" zaehlt, haengt vom Bildschirm ab und steckt in
 * `includeFixed`:
 *
 * - Die Uebersicht rechnet Fixkosten in ihre Summen ein, also ist ein Monat
 *   dort auch dann etwas wert, wenn nur die Miete lief.
 * - Die Ausgabenliste zeigt einzeln Erfasstes. Ein Monat ohne eigene
 *   Eintraege ist dort eine leere Seite, auch wenn die Miete abging - und
 *   waere zudem von allen anderen solchen Monaten nicht zu unterscheiden.
 *
 * Ein Betrag von 0 zaehlt mit: entscheidend ist, ob etwas erfasst wurde,
 * nicht wie viel es war.
 *
 * Luecken sind moeglich und gewollt: wer eine Woche lang nichts erfasst und
 * keine Fixkosten hat, findet diese Woche nicht im Streifen.
 *
 * Immer enthalten sind die laufende Periode - sonst gaebe es nach dem
 * Loeschen der letzten Ausgabe keinen Weg zurueck zu heute - und die in
 * `ensure` uebergebene, damit die gerade gewaehlte Periode nicht unter den
 * Fuessen verschwindet.
 */
export function periodsWithData(
  dataset: Dataset,
  type: PeriodType,
  options: { today?: Date; ensure?: Period; includeFixed?: boolean } = {},
): Period[] {
  const today = options.today ?? new Date();
  const includeFixed = options.includeFixed ?? true;
  const current = makePeriod(type, today);

  const live = dataset.variable.filter((e) => e.deletedAt === null);
  const activeFixed = includeFixed ? dataset.fixed.filter((f) => f.deletedAt === null) : [];

  // Fruehester Tag, ab dem es etwas geben KANN. Alles davor braucht gar
  // nicht erst zum Kandidaten zu werden.
  let earliest = toIsoDate(current.start);
  for (const e of live) if (e.date < earliest) earliest = e.date;
  for (const f of activeFixed) if (f.startDate < earliest) earliest = f.startDate;
  if (options.ensure) {
    const ensureStart = options.ensure.startIso;
    if (ensureStart < earliest) earliest = ensureStart;
  }

  // In welche Periode faellt welche Ausgabe - einmal sammeln statt pro
  // Kandidat erneut ueber alle Ausgaben zu laufen.
  const hit = new Set<string>();
  for (const e of live) hit.add(makePeriod(type, fromIsoDate(e.date)).key);

  const out: Period[] = [];
  let candidate = makePeriod(type, fromIsoDate(earliest));
  for (let i = 0; i < MAX_CANDIDATES && candidate.startIso <= current.startIso; i++) {
    const keep =
      candidate.key === current.key ||
      candidate.key === options.ensure?.key ||
      hit.has(candidate.key) ||
      activeFixed.some((f) => isActiveInPeriod(f, candidate));
    if (keep) out.push(candidate);
    candidate = shiftPeriod(candidate, 1);
  }
  return out;
}

/** Variable Ausgaben innerhalb der Periode, ohne geloeschte. */
export function variableInPeriod(dataset: Dataset, period: Period): VariableExpense[] {
  return dataset.variable.filter(
    (e) => e.deletedAt === null && containsIso(period, e.date),
  );
}

/** Fixkostenpositionen, die in der Periode laufen. */
export function fixedInPeriod(dataset: Dataset, period: Period): FixedExpense[] {
  return dataset.fixed.filter((f) => isActiveInPeriod(f, period));
}

export function periodTotals(
  dataset: Dataset,
  period: Period,
  filter: ExpenseFilter = 'all',
): PeriodTotals {
  const variableRaw =
    filter === 'fixed'
      ? 0
      : variableInPeriod(dataset, period).reduce((sum, e) => sum + e.amountCents, 0);

  const fixedRaw =
    filter === 'variable'
      ? 0
      : fixedInPeriod(dataset, period).reduce((sum, f) => sum + amountInPeriod(f, period), 0);

  const fixedCents = Math.round(fixedRaw);
  const variableCents = Math.round(variableRaw);
  return {
    fixedCents,
    variableCents,
    // Aus den Rohwerten gerundet, nicht aus den beiden gerundeten Teilen -
    // sonst kann die Summe um einen Cent von der Anzeige abweichen.
    totalCents: Math.round(fixedRaw + variableRaw),
  };
}

/**
 * Kategorien der Periode, absteigend nach Betrag.
 *
 * Die gerundeten Zeilen summieren sich exakt auf `periodTotals().totalCents` -
 * darauf gibt es einen Test.
 */
export function categoryRanking(
  dataset: Dataset,
  period: Period,
  filter: ExpenseFilter = 'all',
): CategoryRow[] {
  const raw = new Map<string, number>();
  const add = (categoryId: string, cents: number): void => {
    raw.set(categoryId, (raw.get(categoryId) ?? 0) + cents);
  };

  if (filter !== 'fixed') {
    for (const e of variableInPeriod(dataset, period)) add(e.categoryId, e.amountCents);
  }
  if (filter !== 'variable') {
    for (const f of fixedInPeriod(dataset, period)) add(f.categoryId, amountInPeriod(f, period));
  }

  const entries = [...raw.entries()].sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return [];

  const target = periodTotals(dataset, period, filter).totalCents;
  const rounded = distributeRounding(entries.map(([, cents]) => cents), target);

  return entries.map(([categoryId], i) => {
    const cents = rounded[i] ?? 0;
    return {
      categoryId,
      cents,
      share: target === 0 ? 0 : (cents / target) * 100,
    };
  });
}

/** Werte fuer das Trend-Chart: die letzten N Perioden bis einschliesslich heute. */
export function trendSeries(
  dataset: Dataset,
  period: Period,
  filter: ExpenseFilter = 'all',
  length: number = TREND_LENGTH[period.type],
): TrendPoint[] {
  return lastPeriods(period, length).map((p) => {
    const t = periodTotals(dataset, p, filter);
    return { period: p, ...t };
  });
}

/**
 * Veraenderung zur Vorperiode in Prozent.
 *
 * null, wenn die Vorperiode leer war - "+100 %" gegenueber null Ausgaben
 * ist keine Aussage, sondern eine Division durch fast nichts.
 */
export function deltaToPrevious(
  dataset: Dataset,
  period: Period,
  filter: ExpenseFilter = 'all',
): { percent: number; previousCents: number } | null {
  const previous = lastPeriods(period, 2)[0];
  if (!previous) return null;
  const prev = periodTotals(dataset, previous, filter).totalCents;
  if (prev === 0) return null;
  const current = periodTotals(dataset, period, filter).totalCents;
  return { percent: ((current - prev) / prev) * 100, previousCents: prev };
}

/** Alle Ausgaben einer Kategorie in der Periode, neueste zuerst. */
export function variableByCategory(
  dataset: Dataset,
  period: Period,
  categoryId: string,
): VariableExpense[] {
  return variableInPeriod(dataset, period)
    .filter((e) => e.categoryId === categoryId)
    .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
}

/** Gruppiert Ausgaben nach Tag, neueste zuerst - fuer die Listenansicht
 *  mit Datums-Zwischenueberschrift und Tagessumme. */
export function groupByDay(
  expenses: readonly VariableExpense[],
): { date: string; items: VariableExpense[]; totalCents: number }[] {
  const map = new Map<string, VariableExpense[]>();
  for (const e of expenses) {
    const list = map.get(e.date);
    if (list) list.push(e);
    else map.set(e.date, [e]);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({
      date,
      items: items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      totalCents: items.reduce((s, e) => s + e.amountCents, 0),
    }));
}
