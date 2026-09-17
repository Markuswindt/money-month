import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SegmentedControl } from './SegmentedControl';
import { useUiStore } from '@/store/uiStore';
import {
  isCurrentPeriod, periodLabel, PERIOD_LABELS, PERIOD_TYPES, type PeriodType,
} from '@/lib/periods';
import s from './PeriodNav.module.css';

const OPTIONS = PERIOD_TYPES.map((t) => ({ value: t, label: PERIOD_LABELS[t] }));

/**
 * Zeitraumwahl und Blaettern.
 *
 * "Heute" erscheint nur, wenn man nicht ohnehin dort steht - ein dauerhaft
 * sichtbarer, meist wirkungsloser Knopf kostet nur Platz und Aufmerksamkeit.
 */
export function PeriodNav() {
  const period = useUiStore((st) => st.period);
  const setPeriodType = useUiStore((st) => st.setPeriodType);
  const step = useUiStore((st) => st.step);
  const goToToday = useUiStore((st) => st.goToToday);
  const atToday = isCurrentPeriod(period);

  return (
    <div className={s.wrap}>
      <SegmentedControl<PeriodType>
        value={period.type}
        options={OPTIONS}
        onChange={setPeriodType}
        ariaLabel="Zeitraum"
        className={s.segmented}
      />

      <div className={s.nav}>
        <button
          type="button"
          className="btn btn--icon"
          onClick={() => step(-1)}
          aria-label="Vorheriger Zeitraum"
        >
          <ChevronLeft size={20} aria-hidden />
        </button>

        <h1 className={s.label} aria-live="polite">{periodLabel(period)}</h1>

        <button
          type="button"
          className="btn btn--icon"
          onClick={() => step(1)}
          disabled={atToday}
          aria-label="Nächster Zeitraum"
        >
          <ChevronRight size={20} aria-hidden />
        </button>
      </div>

      {!atToday && (
        <div className={s.todayRow}>
          <button type="button" className="btn btn--ghost btn--sm" onClick={goToToday}>
            Zu heute springen
          </button>
        </div>
      )}
    </div>
  );
}
