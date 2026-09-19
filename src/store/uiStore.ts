import { create } from 'zustand';
import type { ExpenseFilter } from '@/lib/aggregations';
import {
  changePeriodType, makePeriod, shiftPeriod,
  type Period, type PeriodType,
} from '@/lib/periods';

const PERIOD_KEY = 'mm-period-type';

function readPeriodType(): PeriodType {
  try {
    const v = localStorage.getItem(PERIOD_KEY);
    if (v === 'week' || v === 'month' || v === 'year') return v;
  } catch {
    /* ignorieren */
  }
  return 'month';
}

type UiState = {
  period: Period;
  filter: ExpenseFilter;
  setPeriodType: (type: PeriodType) => void;
  setPeriod: (period: Period) => void;
  step: (delta: number) => void;
  goToToday: () => void;
  setFilter: (filter: ExpenseFilter) => void;
};

export const useUiStore = create<UiState>((set, get) => ({
  // Der zuletzt gewaehlte Zeitraum bleibt erhalten, die Periode selbst
  // startet immer bei heute - nach zwei Wochen Pause will niemand dort
  // weitermachen, wo er aufgehoert hat.
  period: makePeriod(readPeriodType()),
  filter: 'all',

  setPeriodType(type) {
    try {
      localStorage.setItem(PERIOD_KEY, type);
    } catch {
      /* ignorieren */
    }
    set({ period: changePeriodType(get().period, type) });
  },

  // Der Auswahlstreifen springt nicht schrittweise, sondern direkt auf eine
  // Periode - step(delta) waere dort eine Umrechnung ohne Nutzen.
  setPeriod(period) {
    set({ period });
  },

  step(delta) {
    set({ period: shiftPeriod(get().period, delta) });
  },

  goToToday() {
    set({ period: makePeriod(get().period.type) });
  },

  setFilter(filter) {
    set({ filter });
  },
}));
