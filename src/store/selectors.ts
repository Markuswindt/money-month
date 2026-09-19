import { useMemo } from 'react';
import { useDataStore } from './dataStore';
import { periodsWithData, type Dataset } from '@/lib/aggregations';
import type { Period } from '@/lib/periods';
import type { Category } from '@/data/schema';
import { isActiveCategory } from '@/data/schema';

/** Das Datenpaket, mit dem alle Aggregationen arbeiten. */
export function useDataset(): Dataset {
  const variable = useDataStore((s) => s.variableExpenses);
  const fixed = useDataStore((s) => s.fixedExpenses);
  return useMemo(() => ({ variable, fixed }), [variable, fixed]);
}

/** Nachschlagetabelle statt find() in jeder Listenzeile - bei 260 Zeilen
 *  waeren das sonst 260 lineare Suchen pro Render. */
export function useCategoryMap(): ReadonlyMap<string, Category> {
  const categories = useDataStore((s) => s.categories);
  return useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
}

/** Kategorien fuer die Auswahl: nicht archiviert, alphabetisch. */
export function useSelectableCategories(): Category[] {
  const categories = useDataStore((s) => s.categories);
  return useMemo(
    () => categories.filter(isActiveCategory).sort((a, b) => a.name.localeCompare(b.name, 'de')),
    [categories],
  );
}

/** Zuletzt benutzte Kategorien zuerst - die haeufigste Auswahl soll der
 *  erste Tipp sein, nicht der alphabetisch erste Eintrag. */
export function useRecentCategoryIds(limit = 4): string[] {
  const variable = useDataStore((s) => s.variableExpenses);
  return useMemo(() => {
    const seen: string[] = [];
    const sorted = [...variable]
      .filter((e) => e.deletedAt === null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    for (const e of sorted) {
      if (!seen.includes(e.categoryId)) seen.push(e.categoryId);
      if (seen.length >= limit) break;
    }
    return seen;
  }, [variable, limit]);
}

/**
 * Die auswaehlbaren Zeitraeume: nur solche, in denen etwas erfasst wurde.
 *
 * Streifen und Chevrons muessen sich dieselbe Liste teilen, sonst springt
 * der Chevron in einen Monat, den der Streifen gar nicht anbietet.
 *
 * Die Basis haengt nur am Typ und behaelt damit ihre Referenz, solange die
 * Auswahl darin vorkommt - der Normalfall. Beim Scrollen wechselt die
 * Auswahl mehrmals pro Sekunde; ein jedes Mal neues Array wuerde React
 * zwingen, alle Pillen neu aufzubauen, waehrend der Finger noch scrollt.
 *
 * `includeFixed` entscheidet, ob ein Zeitraum schon deshalb zaehlt, weil
 * eine Fixkostenposition darin lief - siehe periodsWithData().
 */
export function usePeriodsWithData(selected: Period, includeFixed = true): Period[] {
  const dataset = useDataset();
  const base = useMemo(
    () => periodsWithData(dataset, selected.type, { includeFixed }),
    [dataset, selected.type, includeFixed],
  );
  return useMemo(
    () => (base.some((p) => p.key === selected.key)
      ? base
      : periodsWithData(dataset, selected.type, { ensure: selected, includeFixed })),
    [base, dataset, selected, includeFixed],
  );
}
