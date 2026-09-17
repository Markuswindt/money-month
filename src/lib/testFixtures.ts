import type { FixedExpense, RecurrenceInterval, VariableExpense } from '@/data/schema';

/** Feste Zeitstempel: Tests sollen an Daten scheitern, nicht an der Uhr. */
const T0 = '2026-01-01T00:00:00.000Z';

export function fixed(
  over: Partial<FixedExpense> & { amountCents: number; interval: RecurrenceInterval },
): FixedExpense {
  return {
    id: over.id ?? 'fix-1',
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    categoryId: over.categoryId ?? 'cat-wohnen',
    dueDay: over.dueDay ?? 1,
    note: over.note ?? '',
    startDate: over.startDate ?? '2020-01-01',
    endDate: over.endDate ?? null,
    ...over,
  };
}

export function variable(
  over: Partial<VariableExpense> & { amountCents: number; date: string },
): VariableExpense {
  return {
    id: over.id ?? `var-${over.date}-${over.amountCents}`,
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    categoryId: over.categoryId ?? 'cat-lebensmittel',
    note: over.note ?? '',
    ...over,
  };
}
