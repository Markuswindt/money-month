import { useMemo } from 'react';
import { addDays } from 'date-fns';
import { Money } from '@/components/ui/Money';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { EmptyState } from '@/components/ui/EmptyState';
import { categoryColorVars } from '@/lib/categoryColor';
import { formatDayLabel, fromIsoDate, toIsoDate, todayIso } from '@/lib/periods';
import { dueDatesBetween, monthlyCents, nextDueDate } from '@/lib/recurrence';
import { INTERVAL_LABELS } from '@/data/schema';
import { useCategoryMap } from '@/store/selectors';
import { useDataStore } from '@/store/dataStore';
import { useEntryStore } from '@/store/entryStore';
import s from './Fixed.module.css';

const TIMELINE_DAYS = 30;

export function FixedScreen() {
  const fixedExpenses = useDataStore((st) => st.fixedExpenses);
  const categories = useCategoryMap();
  const openNew = useEntryStore((st) => st.openNew);
  const edit = useEntryStore((st) => st.editFixed);
  const today = todayIso();

  const { active, ended, monthlyTotal } = useMemo(() => {
    const live = fixedExpenses.filter((f) => f.deletedAt === null);
    const act = live
      .filter((f) => f.endDate === null || f.endDate >= today)
      .sort((a, b) => monthlyCents(b) - monthlyCents(a));
    const end = live.filter((f) => f.endDate !== null && f.endDate < today);
    return {
      active: act,
      ended: end,
      monthlyTotal: Math.round(act.reduce((sum, f) => sum + monthlyCents(f), 0)),
    };
  }, [fixedExpenses, today]);

  /** Die naechsten 30 Tage, chronologisch - beantwortet "was geht demnächst ab". */
  const timeline = useMemo(() => {
    const until = toIsoDate(addDays(fromIsoDate(today), TIMELINE_DAYS));
    const entries = active.flatMap((f) =>
      dueDatesBetween(f, today, until).map((date) => ({ date, fixed: f })),
    );
    return entries.sort((a, b) => a.date.localeCompare(b.date));
  }, [active, today]);

  if (active.length === 0 && ended.length === 0) {
    return (
      <EmptyState
        title="Keine Fixkosten"
        hint="Miete, Abos und Versicherungen einmal eintragen — sie werden dann automatisch auf jeden Zeitraum umgerechnet."
        action={
          <button type="button" className="btn btn--primary" onClick={() => openNew('fixed')}>
            Fixkosten anlegen
          </button>
        }
      />
    );
  }

  return (
    <div className={s.page}>
      <section className={s.summary}>
        <span className="sectionTitle">Fixkosten gesamt</span>
        <Money cents={monthlyTotal} className={s.summaryAmount} />
        <span className={s.summaryMeta}>
          Ø pro Monat · <Money cents={monthlyTotal * 12} /> pro Jahr
        </span>
      </section>

      <section className={s.section}>
        <h2 className="sectionTitle">Laufend</h2>
        <div className="card card--flush">
          {active.map((fixed) => {
            const category = categories.get(fixed.categoryId);
            const next = nextDueDate(fixed, today);
            return (
              <button
                key={fixed.id}
                type="button"
                className="listRow"
                style={categoryColorVars(category?.color ?? 'cyan')}
                onClick={() => edit(fixed)}
              >
                <span className="catBadge">
                  <CategoryIcon name={category?.icon ?? 'Tag'} size={20} />
                </span>
                <span className="listRow__body">
                  <span className="listRow__title">{fixed.note || category?.name || 'Fixkosten'}</span>
                  <span className="listRow__meta">
                    {INTERVAL_LABELS[fixed.interval]}
                    {fixed.interval !== 'monthly' && (
                      <> · Ø <Money cents={Math.round(monthlyCents(fixed))} /> / Monat</>
                    )}
                  </span>
                </span>
                <span className={s.rowAside}>
                  <Money cents={fixed.amountCents} className={s.rowAmount} />
                  {next && <span className={s.rowAverage}>am {formatDayLabel(next)}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {timeline.length > 0 && (
        <section className={s.section}>
          <h2 className="sectionTitle">Nächste Abbuchungen · 30 Tage</h2>
          <div className="card card--flush">
            <div className={s.timeline}>
              {timeline.map(({ date, fixed }) => {
                const category = categories.get(fixed.categoryId);
                return (
                  <div key={`${fixed.id}-${date}`} className={s.timelineRow}>
                    <span className={s.timelineDate}>{formatDayLabel(date)}</span>
                    <span className={s.timelineName}>
                      {fixed.note || category?.name || 'Fixkosten'}
                    </span>
                    <Money cents={fixed.amountCents} className="listRow__amount" />
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {ended.length > 0 && (
        <section className={s.section}>
          <h2 className="sectionTitle">Beendet</h2>
          <div className={`card card--flush ${s.ended}`}>
            {ended.map((fixed) => {
              const category = categories.get(fixed.categoryId);
              return (
                <button
                  key={fixed.id}
                  type="button"
                  className="listRow"
                  style={categoryColorVars(category?.color ?? 'cyan')}
                  onClick={() => edit(fixed)}
                >
                  <span className="listRow__body">
                    <span className="listRow__title">{fixed.note || category?.name}</span>
                    <span className="listRow__meta">bis {fixed.endDate}</span>
                  </span>
                  <Money cents={fixed.amountCents} className="listRow__amount" />
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
