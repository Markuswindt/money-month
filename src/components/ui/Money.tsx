import { formatMoney, formatMoneyRounded, type Cents } from '@/lib/money';

/**
 * Jeder Geldbetrag laeuft ueber diese Komponente.
 *
 * Grund: `tabular-nums` darf nirgends vergessen werden. Ohne gleich breite
 * Ziffern tanzen die Betraege in einer Liste horizontal, sobald sich eine
 * Stelle aendert - das liest sich unruhig und macht Spalten unvergleichbar.
 */
export function Money({
  cents,
  rounded = false,
  className,
}: {
  cents: Cents;
  rounded?: boolean | undefined;
  className?: string | undefined;
}) {
  const text = rounded ? formatMoneyRounded(cents) : formatMoney(cents);
  return (
    <span className={className ? `tabular ${className}` : 'tabular'}>{text}</span>
  );
}
