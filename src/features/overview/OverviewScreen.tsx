import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { PeriodNav } from '@/components/ui/PeriodNav';
import { Money } from '@/components/ui/Money';
import { EmptyState } from '@/components/ui/EmptyState';
import { SplitBar } from '@/components/charts/SplitBar';
import { CategoryRanking } from '@/components/charts/CategoryRanking';
import { TrendBars } from '@/components/charts/TrendBars';
import { ExpenseRow } from '@/features/expenses/ExpenseRow';
import { useUiStore } from '@/store/uiStore';
import { useCategoryMap, useDataset } from '@/store/selectors';
import {
  categoryRanking, deltaToPrevious, FILTER_LABELS, periodTotals, trendSeries,
  variableInPeriod, type ExpenseFilter,
} from '@/lib/aggregations';
import { previousPeriodLabel } from '@/lib/periods';
import s from './Overview.module.css';

const FILTERS: readonly ExpenseFilter[] = ['all', 'variable', 'fixed'];

export function OverviewScreen() {
  const period = useUiStore((st) => st.period);
  const filter = useUiStore((st) => st.filter);
  const setFilter = useUiStore((st) => st.setFilter);
  const dataset = useDataset();
  const categories = useCategoryMap();
  const navigate = useNavigate();

  const totals = useMemo(() => periodTotals(dataset, period, filter), [dataset, period, filter]);
  const ranking = useMemo(() => categoryRanking(dataset, period, filter), [dataset, period, filter]);
  const trend = useMemo(() => trendSeries(dataset, period, filter), [dataset, period, filter]);
  const delta = useMemo(() => deltaToPrevious(dataset, period, filter), [dataset, period, filter]);
  const recent = useMemo(
    () =>
      variableInPeriod(dataset, period)
        .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)))
        .slice(0, 5),
    [dataset, period],
  );

  // In der Wochen- und Jahresansicht ist der Fixkostenanteil ein Durchschnitt,
  // kein tatsaechlich abgebuchter Betrag. Das muss dranstehen.
  const showAverageHint = period.type !== 'month';

  return (
    <div className={s.page}>
      <PeriodNav />

      <section className={s.hero}>
        <div className={s.heroTop}>
          <Money cents={totals.totalCents} className={s.heroAmount} />
          <p className={s.heroMeta}>
            {delta ? (
              <span className={`${s.delta} ${delta.percent >= 0 ? s.deltaUp : s.deltaDown}`}>
                {delta.percent >= 0 ? <TrendingUp size={14} aria-hidden /> : <TrendingDown size={14} aria-hidden />}
                {delta.percent >= 0 ? '+' : ''}{delta.percent.toFixed(0)} % ggü. {previousPeriodLabel(period)}
              </span>
            ) : (
              <span>Kein Vergleichswert für {previousPeriodLabel(period)}</span>
            )}
          </p>
        </div>

        {totals.totalCents > 0 && (
          <SplitBar totals={totals} showAverageHint={showAverageHint} />
        )}

        {showAverageHint && totals.fixedCents > 0 && (
          <p className={s.averageNote}>
            Fixkosten sind auf den Zeitraum umgerechnet, nicht die tatsächliche Abbuchung.
          </p>
        )}
      </section>

      <div className={s.filters} role="group" aria-label="Ausgabenart">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className="chip"
            data-selected={filter === f ? '' : undefined}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      <section className={s.section}>
        <h2 className="sectionTitle">Nach Kategorie</h2>
        <div className="card card--flush">
          {ranking.length > 0 ? (
            <CategoryRanking
              rows={ranking}
              categories={categories}
              onSelect={(id) => navigate(`/kategorie/${id}`)}
            />
          ) : (
            <EmptyState
              title="Nichts erfasst"
              hint="In diesem Zeitraum gibt es noch keine Ausgaben."
            />
          )}
        </div>
      </section>

      <section className={s.section}>
        <h2 className="sectionTitle">Verlauf</h2>
        <div className="card">
          <TrendBars points={trend} />
        </div>
      </section>

      {recent.length > 0 && (
        <section className={s.section}>
          <div className={s.sectionHead}>
            <h2 className="sectionTitle">Zuletzt erfasst</h2>
            <Link to="/ausgaben" className="inlineLink">Alle anzeigen</Link>
          </div>
          <div className="card card--flush">
            {recent.map((expense) => (
              <ExpenseRow key={expense.id} expense={expense} category={categories.get(expense.categoryId)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
