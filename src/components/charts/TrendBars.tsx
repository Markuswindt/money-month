import { useState, type CSSProperties } from 'react';
import { Money } from '@/components/ui/Money';
import { isCurrentPeriod, periodLabel, periodShortLabel } from '@/lib/periods';
import type { TrendPoint } from '@/lib/aggregations';
import c from './charts.module.css';

/**
 * Verlauf ueber die letzten Perioden, fix und variabel gestapelt.
 *
 * Die aktuelle Periode ist hervorgehoben, damit der Vergleichspunkt nicht
 * gesucht werden muss. Beim Zeigen erscheint die Aufschluesselung - ohne
 * das waere ein Balken nur eine Form ohne Zahl.
 */
export function TrendBars({ points }: { points: readonly TrendPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((p) => p.totalCents));
  const activePoint = active === null ? null : points[active];

  return (
    <div className={c.trend}>
      <div className={c.trendPlot}>
        {points.map((point, i) => {
          const height = (point.totalCents / max) * 100;
          const fixedShare = point.totalCents > 0 ? point.fixedCents / point.totalCents : 0;
          const current = isCurrentPeriod(point.period);
          return (
            <button
              key={point.period.key}
              type="button"
              className={c.trendCol}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              aria-label={`${periodLabel(point.period)}: ${(point.totalCents / 100).toFixed(2)} Euro`}
            >
              <span
                className={c.trendStack}
                style={{
                  height: `${Math.max(height, 1.5)}%`,
                  opacity: current || active === i ? 1 : 0.72,
                  '--i': i,
                } as CSSProperties}
              >
                <span
                  className={c.trendSeg}
                  style={{ flexGrow: 1 - fixedShare, background: 'var(--expense-variable)' }}
                />
                <span
                  className={c.trendSeg}
                  style={{ flexGrow: fixedShare, background: 'var(--expense-fixed)' }}
                />
              </span>
            </button>
          );
        })}
      </div>

      <div className={c.trendAxis} aria-hidden>
        {points.map((point) => (
          <span
            key={point.period.key}
            className={`${c.trendTick} ${isCurrentPeriod(point.period) ? c.trendTickCurrent : ''}`}
          >
            {periodShortLabel(point.period)}
          </span>
        ))}
      </div>

      {activePoint && (
        <div
          className={c.tooltip}
          style={{
            left: `${((active! + 0.5) / points.length) * 100}%`,
            top: '-0.5rem',
          }}
        >
          <span className={c.tooltipTitle}>{periodLabel(activePoint.period)}</span>
          <span className={c.tooltipRow}>
            <span className={c.legendSwatch} style={{ background: 'var(--expense-fixed)' }} />
            <span>Fix</span>
            <Money cents={activePoint.fixedCents} />
          </span>
          <span className={c.tooltipRow}>
            <span className={c.legendSwatch} style={{ background: 'var(--expense-variable)' }} />
            <span>Variabel</span>
            <Money cents={activePoint.variableCents} />
          </span>
          <span className={`${c.tooltipRow} ${c.tooltipTotal}`}>
            <span>Gesamt</span>
            <Money cents={activePoint.totalCents} />
          </span>
        </div>
      )}
    </div>
  );
}
