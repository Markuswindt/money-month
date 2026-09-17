import { useState } from 'react';
import { Money } from '@/components/ui/Money';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { categoryColorVars } from '@/lib/categoryColor';
import type { CategoryRow } from '@/lib/aggregations';
import type { Category } from '@/data/schema';
import c from './charts.module.css';

const COLLAPSED_COUNT = 6;

/**
 * Rangliste statt Kreisdiagramm.
 *
 * Ein Donut mit vierzehn Segmenten waere eine Legenden-Suchaufgabe: die
 * Kategoriefarben liegen messbar zu dicht beieinander (purple/violet ΔE 1,1),
 * um sie im Kreis auseinanderzuhalten. Die Rangliste zeigt Reihenfolge,
 * Betrag und Anteil direkt am Namen - die Farbe ist dann Zugabe.
 *
 * Alle Balken teilen sich einen Farbton: sie beantworten eine Groessenfrage.
 * Die Kategorie steht als Wort daneben, ihr Farbpunkt direkt davor.
 */
export function CategoryRanking({
  rows,
  categories,
  onSelect,
}: {
  rows: readonly CategoryRow[];
  categories: ReadonlyMap<string, Category>;
  onSelect: (categoryId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const max = rows[0]?.cents ?? 0;
  const visible = expanded ? rows : rows.slice(0, COLLAPSED_COUNT);
  const hidden = rows.length - visible.length;

  return (
    <div className={c.ranking}>
      {visible.map((row) => {
        const category = categories.get(row.categoryId);
        const width = max > 0 ? Math.max(1.5, (row.cents / max) * 100) : 0;
        return (
          <button
            key={row.categoryId}
            type="button"
            className={c.rankRow}
            style={categoryColorVars(category?.color ?? 'cyan')}
            onClick={() => onSelect(row.categoryId)}
          >
            <span className="catBadge">
              <CategoryIcon name={category?.icon ?? 'Tag'} size={20} />
            </span>
            <span className={c.rankLabel}>{category?.name ?? 'Unbekannt'}</span>
            <span>
              <Money cents={row.cents} className={c.rankValue} />
              <span className={c.rankShare}>{row.share.toFixed(0)} %</span>
            </span>
            <span className={c.rankBarCell}>
              <span className={c.rankBar}>
                <span className={c.rankFill} style={{ width: `${width}%` }} />
              </span>
            </span>
          </button>
        );
      })}

      {hidden > 0 && (
        <button type="button" className={c.moreButton} onClick={() => setExpanded(true)}>
          {hidden} weitere Kategorien anzeigen
        </button>
      )}
      {expanded && rows.length > COLLAPSED_COUNT && (
        <button type="button" className={c.moreButton} onClick={() => setExpanded(false)}>
          Weniger anzeigen
        </button>
      )}
    </div>
  );
}
