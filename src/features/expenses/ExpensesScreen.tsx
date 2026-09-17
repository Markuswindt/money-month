import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { PeriodNav } from '@/components/ui/PeriodNav';
import { EmptyState } from '@/components/ui/EmptyState';
import { Money } from '@/components/ui/Money';
import { ExpenseRow } from './ExpenseRow';
import { categoryColorVars } from '@/lib/categoryColor';
import { groupByDay, variableInPeriod } from '@/lib/aggregations';
import { formatDayLabel } from '@/lib/periods';
import { useUiStore } from '@/store/uiStore';
import { useCategoryMap, useDataset, useSelectableCategories } from '@/store/selectors';
import { useEntryStore } from '@/store/entryStore';
import s from './Expenses.module.css';

export function ExpensesScreen() {
  const period = useUiStore((st) => st.period);
  const dataset = useDataset();
  const categories = useCategoryMap();
  const selectable = useSelectableCategories();
  const openNew = useEntryStore((st) => st.openNew);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const expenses = useMemo(() => {
    const q = query.trim().toLowerCase();
    return variableInPeriod(dataset, period).filter((e) => {
      if (selected.length > 0 && !selected.includes(e.categoryId)) return false;
      if (q === '') return true;
      const name = categories.get(e.categoryId)?.name.toLowerCase() ?? '';
      return e.note.toLowerCase().includes(q) || name.includes(q);
    });
  }, [dataset, period, query, selected, categories]);

  const groups = useMemo(() => groupByDay(expenses), [expenses]);
  const total = useMemo(() => expenses.reduce((sum, e) => sum + e.amountCents, 0), [expenses]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className={s.page}>
      <PeriodNav />

      <div className={s.search}>
        <Search size={18} className={s.searchIcon} aria-hidden />
        <input
          type="search"
          className={`input ${s.searchInput}`}
          placeholder="Notiz oder Kategorie suchen"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Ausgaben durchsuchen"
        />
      </div>

      <div className={s.filterScroll} role="group" aria-label="Nach Kategorie filtern">
        {selected.length > 0 && (
          <button type="button" className="chip" onClick={() => setSelected([])}>
            Filter zurücksetzen
          </button>
        )}
        {selectable.map((category) => (
          <button
            key={category.id}
            type="button"
            className="chip chip--category"
            style={categoryColorVars(category.color)}
            data-selected={selected.includes(category.id) ? '' : undefined}
            aria-pressed={selected.includes(category.id)}
            onClick={() => toggle(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>

      <p className={s.summary}>
        <span>{expenses.length} {expenses.length === 1 ? 'Ausgabe' : 'Ausgaben'}</span>
        <Money cents={total} />
      </p>

      {groups.length === 0 ? (
        <EmptyState
          title={query || selected.length > 0 ? 'Nichts gefunden' : 'Noch keine Ausgaben'}
          hint={
            query || selected.length > 0
              ? 'Andere Suche oder Filter versuchen.'
              : 'Erfasse die erste Ausgabe für diesen Zeitraum.'
          }
          action={
            query || selected.length > 0 ? undefined : (
              <button type="button" className="btn btn--primary" onClick={() => openNew('variable')}>
                Ausgabe erfassen
              </button>
            )
          }
        />
      ) : (
        groups.map((group) => (
          <section key={group.date} className={s.dayGroup}>
            <header className={s.dayHeader}>
              <span>{formatDayLabel(group.date)}</span>
              <Money cents={group.totalCents} className={s.dayTotal} />
            </header>
            <div className="card card--flush">
              {group.items.map((expense) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  category={categories.get(expense.categoryId)}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
