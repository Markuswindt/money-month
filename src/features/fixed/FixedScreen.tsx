import { Fragment, useMemo } from 'react';
import { addDays } from 'date-fns';
import { Money } from '@/components/ui/Money';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { EmptyState } from '@/components/ui/EmptyState';
import { categoryColorVars } from '@/lib/categoryColor';
import {
  formatDayLabel, formatDayOfMonth, formatMonthHeading, formatWeekdayAbbrev,
  fromIsoDate, toIsoDate, todayIso,
} from '@/lib/periods';
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

  /** Die naechsten 30 Tage, nach Tag gruppiert - eine Zeile pro Faelligkeit,
   *  aber nur EIN Punkt auf der Zeitleiste pro Tag, auch wenn mehrere
   *  Fixkosten am selben Tag abgebucht werden. */
  const timeline = useMemo(() => {
    const until = toIsoDate(addDays(fromIsoDate(today), TIMELINE_DAYS));
    const entries = active.flatMap((f) =>
      dueDatesBetween(f, today, until).map((date) => ({ date, fixed: f })),
    );
    entries.sort((a, b) => a.date.localeCompare(b.date));

    const byDate = new Map<string, typeof entries[number]['fixed'][]>();
    for (const { date, fixed } of entries) {
      const bucket = byDate.get(date);
      if (bucket) bucket.push(fixed);
      else byDate.set(date, [fixed]);
    }
    return Array.from(byDate, ([date, items]) => ({ date, items }));
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
          <div className="card">
            <div className={s.timeline}>
              {timeline.map(({ date, items }, i) => {
                const isToday = date === today;
                const isLastDay = i === timeline.length - 1;
                const showMonth = i === 0 || timeline[i - 1]!.date.slice(0, 7) !== date.slice(0, 7);
                return (
                  <Fragment key={date}>
                    {showMonth && <h3 className={s.timelineMonth}>{formatMonthHeading(date)}</h3>}
                    <div className={s.timelineDay} data-today={isToday || undefined} data-last={isLastDay || undefined}>
                      <div className={s.timelineStep}>
                        <span className={s.timelineWeekday}>
                          {isToday ? 'Heute' : formatWeekdayAbbrev(date)}
                        </span>
                        <span className={s.timelineDayNumber}>{formatDayOfMonth(date)}</span>
                      </div>
                      <div className={s.timelineDayBody}>
                        {items.map((fixed) => {
                          const category = categories.get(fixed.categoryId);
                          return (
                            <div key={fixed.id} className={s.timelineEntry}>
                              <span
                                className={s.timelineEntryDot}
                                style={categoryColorVars(category?.color ?? 'cyan')}
                              />
                              <span className={s.timelineEntryName}>
                                {fixed.note || category?.name || 'Fixkosten'}
                              </span>
                              <Money cents={fixed.amountCents} className={s.timelineEntryAmount} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </Fragment>
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
