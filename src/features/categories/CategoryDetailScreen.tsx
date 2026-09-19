import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { PeriodNav } from '@/components/ui/PeriodNav';
import { Money } from '@/components/ui/Money';
import { EmptyState } from '@/components/ui/EmptyState';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { TrendBars } from '@/components/charts/TrendBars';
import { ExpenseRow } from '@/features/expenses/ExpenseRow';
import { categoryColorVars } from '@/lib/categoryColor';
import { percentOf } from '@/lib/money';
import { lastPeriods, TREND_LENGTH } from '@/lib/periods';
import { monthlyCents } from '@/lib/recurrence';
import { INTERVAL_LABELS } from '@/data/schema';
import {
  groupByDay, periodTotals, variableByCategory, type Dataset,
} from '@/lib/aggregations';
import { useUiStore } from '@/store/uiStore';
import { useCategoryMap, useDataset } from '@/store/selectors';
import { useDataStore } from '@/store/dataStore';
import { useEntryStore } from '@/store/entryStore';
import s from './CategoryDetail.module.css';

export function CategoryDetailScreen() {
  const { categoryId = '' } = useParams();
  const period = useUiStore((st) => st.period);
  const dataset = useDataset();
  const categories = useCategoryMap();
  const fixedExpenses = useDataStore((st) => st.fixedExpenses);
  const openNew = useEntryStore((st) => st.openNew);
  const editFixed = useEntryStore((st) => st.editFixed);

  const category = categories.get(categoryId);

  /** Dieselben Aggregationen wie im Dashboard, nur auf diese Kategorie
   *  eingeschraenkt - so koennen die Zahlen gar nicht auseinanderlaufen. */
  const scoped: Dataset = useMemo(
    () => ({
      variable: dataset.variable.filter((e) => e.categoryId === categoryId),
      fixed: dataset.fixed.filter((f) => f.categoryId === categoryId),
    }),
    [dataset, categoryId],
  );

  const totals = useMemo(() => periodTotals(scoped, period), [scoped, period]);
  const overall = useMemo(() => periodTotals(dataset, period), [dataset, period]);
  const trend = useMemo(
    () =>
      lastPeriods(period, TREND_LENGTH[period.type]).map((p) => ({
        period: p,
        ...periodTotals(scoped, p),
      })),
    [scoped, period],
  );
  const expenses = useMemo(() => variableByCategory(dataset, period, categoryId), [dataset, period, categoryId]);
  const groups = useMemo(() => groupByDay(expenses), [expenses]);
  const relatedFixed = useMemo(
    () => fixedExpenses.filter((f) => f.deletedAt === null && f.categoryId === categoryId),
    [fixedExpenses, categoryId],
  );

  if (!category) {
    return <EmptyState title="Kategorie nicht gefunden" hint="Sie wurde vielleicht gelöscht." />;
  }

  return (
    <div className={s.page} data-period-swipe style={categoryColorVars(category.color)}>
      <Link to="/" className={s.back}>
        <ChevronLeft size={18} aria-hidden />
        Übersicht
      </Link>

      <div className={s.head}>
        <span className={s.headIcon}>
          <CategoryIcon name={category.icon} size={22} />
        </span>
        <span className={s.headText}>
          <span className={s.headName}>{category.name}</span>
          <span className={s.headMeta}>
            {percentOf(totals.totalCents, overall.totalCents).toFixed(0)} % aller Ausgaben im Zeitraum
          </span>
        </span>
      </div>

      <PeriodNav />

      <section className={`card ${s.statCard}`}>
        <Money cents={totals.totalCents} className={s.amount} />
        {totals.fixedCents > 0 && totals.variableCents > 0 && (
          <span className={s.headMeta}>
            davon <Money cents={totals.fixedCents} /> fix und{' '}
            <Money cents={totals.variableCents} /> variabel
          </span>
        )}
      </section>

      <section className={s.section}>
        <h2 className="sectionTitle">Verlauf</h2>
        <div className="card">
          <TrendBars points={trend} />
        </div>
      </section>

      {relatedFixed.length > 0 && (
        <section className={s.section}>
          <h2 className="sectionTitle">Fixkosten</h2>
          <div className="card card--flush">
            {relatedFixed.map((fixed) => (
              <button
                key={fixed.id}
                type="button"
                className="listRow"
                onClick={() => editFixed(fixed)}
              >
                <span className="listRow__body">
                  <span className="listRow__title">{fixed.note || category.name}</span>
                  <span className="listRow__meta">
                    {INTERVAL_LABELS[fixed.interval]} · Ø{' '}
                    <Money cents={Math.round(monthlyCents(fixed))} /> / Monat
                  </span>
                </span>
                <Money cents={fixed.amountCents} className="listRow__amount" />
              </button>
            ))}
          </div>
        </section>
      )}

      <section className={s.section}>
        <h2 className="sectionTitle">Einzelne Ausgaben</h2>
        {groups.length === 0 ? (
          <EmptyState
            title="Keine Ausgaben im Zeitraum"
            action={
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => openNew('variable', categoryId)}
              >
                Ausgabe erfassen
              </button>
            }
          />
        ) : (
          groups.map((group) => (
            <div key={group.date} className="card card--flush">
              {group.items.map((expense) => (
                <ExpenseRow key={expense.id} expense={expense} category={category} showDate />
              ))}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
