import { useMemo } from 'react';
import { useDataStore } from './dataStore';
import type { Dataset } from '@/lib/aggregations';
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
