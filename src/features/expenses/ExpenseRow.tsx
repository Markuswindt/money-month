import { Money } from '@/components/ui/Money';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { categoryColorVars } from '@/lib/categoryColor';
import { formatDayLabel } from '@/lib/periods';
import { useEntryStore } from '@/store/entryStore';
import type { Category, VariableExpense } from '@/data/schema';

/** Eine Ausgabe in einer Liste. Tippen oeffnet sie zum Bearbeiten -
 *  ein separates Bearbeiten-Symbol waere ein zusaetzliches Ziel fuer
 *  dieselbe Absicht. */
export function ExpenseRow({
  expense,
  category,
  showDate = false,
}: {
  expense: VariableExpense;
  category: Category | undefined;
  showDate?: boolean;
}) {
  const edit = useEntryStore((s) => s.editVariable);
  const meta = [showDate ? formatDayLabel(expense.date) : null, expense.note]
    .filter(Boolean)
    .join(' · ');

  return (
    <button
      type="button"
      className="listRow"
      style={categoryColorVars(category?.color ?? 'cyan')}
      onClick={() => edit(expense)}
    >
      <span className="catBadge">
        <CategoryIcon name={category?.icon ?? 'Tag'} size={20} />
      </span>
      <span className="listRow__body">
        <span className="listRow__title">{category?.name ?? 'Ohne Kategorie'}</span>
        {meta && <span className="listRow__meta">{meta}</span>}
      </span>
      <Money cents={expense.amountCents} className="listRow__amount" />
    </button>
  );
}
