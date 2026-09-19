import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SegmentedControl } from './SegmentedControl';
import { PeriodStrip } from './PeriodStrip';
import { useUiStore } from '@/store/uiStore';
import { usePeriodsWithData } from '@/store/selectors';
import { periodLabel, PERIOD_LABELS, PERIOD_TYPES, type PeriodType } from '@/lib/periods';
import s from './PeriodNav.module.css';

const OPTIONS = PERIOD_TYPES.map((t) => ({ value: t, label: PERIOD_LABELS[t] }));

/**
 * Zeitraumwahl und Blaettern.
 *
 * Das Blaettern liegt im einrastenden Streifen darunter. Die frueheren
 * Chevrons bleiben nur auf dem Desktop: eine Maus scrollt waagerecht
 * schlecht, ein Finger nicht.
 *
 * Sie blaettern durch dieselbe Liste wie der Streifen, nicht um eine
 * Kalenderperiode. Sonst landete ein Klick in einem Monat, in dem nichts
 * erfasst wurde - also in einem, den der Streifen daneben gar nicht
 * anbietet. Am Rand der Liste sind sie deshalb deaktiviert.
 *
 * `includeFixed` steuert, welche Zeitraeume ueberhaupt auftauchen: in der
 * Uebersicht zaehlt ein Monat schon, wenn nur die Miete lief, in der
 * Ausgabenliste nicht - dort waere er eine leere Seite.
 *
 * Die sichtbare Ueberschrift ist der zentrierte Streifen-Eintrag, der aber
 * ein Knopf ist und keine Ueberschrift sein kann. Das <h1> steht deshalb
 * nur fuer Screenreader daneben - sonst haetten die drei Screens, die
 * dieses Bauteil einbinden, gar keine.
 */
export function PeriodNav({ includeFixed = true }: { includeFixed?: boolean }) {
  const period = useUiStore((st) => st.period);
  const setPeriod = useUiStore((st) => st.setPeriod);
  const setPeriodType = useUiStore((st) => st.setPeriodType);
  const periods = usePeriodsWithData(period, includeFixed);

  const index = periods.findIndex((p) => p.key === period.key);
  const goBy = (delta: number) => {
    const next = periods[index + delta];
    if (next) setPeriod(next);
  };

  return (
    <div className={s.wrap} data-period-nav>
      <SegmentedControl<PeriodType>
        value={period.type}
        options={OPTIONS}
        onChange={setPeriodType}
        ariaLabel="Zeitraum"
        className={s.segmented}
      />

      <h1 className="visually-hidden" aria-live="polite">{periodLabel(period)}</h1>

      <div className={s.nav}>
        <button
          type="button"
          className={`btn btn--icon ${s.navArrow}`}
          onClick={() => goBy(-1)}
          disabled={index <= 0}
          aria-label="Vorheriger Zeitraum"
        >
          <ChevronLeft size={20} aria-hidden />
        </button>

        <PeriodStrip includeFixed={includeFixed} />

        <button
          type="button"
          className={`btn btn--icon ${s.navArrow}`}
          onClick={() => goBy(1)}
          disabled={index < 0 || index >= periods.length - 1}
          aria-label="Nächster Zeitraum"
        >
          <ChevronRight size={20} aria-hidden />
        </button>
      </div>
    </div>
  );
}
