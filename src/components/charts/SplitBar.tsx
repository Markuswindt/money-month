import { Money } from '@/components/ui/Money';
import type { PeriodTotals } from '@/lib/aggregations';
import c from './charts.module.css';

/**
 * Fix gegen variabel als ein einziger gestapelter Balken.
 *
 * Zwei Reihen, deren Identitaet allein an der Farbe haengt - deshalb sind
 * das die einzigen beiden Farben der App, die gegen Farbfehlsichtigkeit
 * geprueft wurden (siehe theme.css). Zusaetzlich steht jeder Wert als Zahl
 * in der Legende: Farbe ist nie der einzige Traeger.
 */
export function SplitBar({ totals, showAverageHint }: { totals: PeriodTotals; showAverageHint?: boolean }) {
  const { fixedCents, variableCents, totalCents } = totals;
  const fixedPct = totalCents > 0 ? (fixedCents / totalCents) * 100 : 0;
  const variablePct = totalCents > 0 ? (variableCents / totalCents) * 100 : 0;

  return (
    <div className={c.split}>
      <div
        className={c.splitTrack}
        role="img"
        aria-label={`Fixkosten ${(fixedPct).toFixed(0)} Prozent, variable Kosten ${(variablePct).toFixed(0)} Prozent`}
      >
        {fixedCents > 0 && (
          <div
            className={c.splitSegment}
            style={{ flexBasis: `${fixedPct}%`, background: 'var(--expense-fixed)' }}
          />
        )}
        {variableCents > 0 && (
          <div
            className={c.splitSegment}
            style={{ flexBasis: `${variablePct}%`, background: 'var(--expense-variable)' }}
          />
        )}
      </div>

      <div className={c.legend}>
        <div className={c.legendItem}>
          <span className={c.legendSwatch} style={{ background: 'var(--expense-fixed)' }} />
          <span className={c.legendText}>
            <span className={c.legendLabel}>
              {showAverageHint ? 'Fixkosten Ø' : 'Fixkosten'}
            </span>
            <Money cents={fixedCents} className={c.legendValue} />
          </span>
        </div>
        <div className={c.legendItem}>
          <span className={c.legendSwatch} style={{ background: 'var(--expense-variable)' }} />
          <span className={c.legendText}>
            <span className={c.legendLabel}>Variabel</span>
            <Money cents={variableCents} className={c.legendValue} />
          </span>
        </div>
      </div>
    </div>
  );
}
