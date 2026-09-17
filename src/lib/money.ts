/** Geldarithmetik.
 *
 *  Betraege sind IMMER ganzzahlige Cent. Fliesskomma-Euro summiert sich
 *  falsch (0.1 + 0.2 = 0.30000000000000004) - in einem Ausgaben-Tracker
 *  faellt das nach ein paar hundert Eintraegen als Cent-Drift auf.
 */

export type Cents = number;

/** 10 Mio Euro. Keine echte fachliche Grenze, sondern ein Netz gegen
 *  Tippfehler wie einen versehentlich doppelten Tastendruck. */
export const MAX_CENTS = 1_000_000_000;

const currencyFormat = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

const currencyFormatNoFraction = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const decimalFormat = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "1.099,30 €" */
export function formatMoney(cents: Cents): string {
  return currencyFormat.format(cents / 100);
}

/** "1.099 €" - fuer Chart-Achsen und enge Stellen, wo Cent nur stoeren. */
export function formatMoneyRounded(cents: Cents): string {
  return currencyFormatNoFraction.format(Math.round(cents / 100));
}

/** "1.099,30" ohne Waehrungszeichen - fuer Eingabefelder und CSV. */
export function formatDecimal(cents: Cents): string {
  return decimalFormat.format(cents / 100);
}

/**
 * Parst eine Betragseingabe zu Cent. `null`, wenn nichts Sinnvolles drinsteht.
 *
 * Akzeptiert bewusst mehrere Schreibweisen, statt eine zu erzwingen - laut
 * Baymard geben Nutzer Zahlen in ganz unterschiedlichen Formaten ein, und
 * strenge Validierung erzeugt dort nur Fehlermeldungen statt besserer Daten.
 *
 * Regeln:
 *   - Waehrungszeichen, Leerraum und schmale Leerzeichen fliegen raus
 *   - Komma UND Punkt vorhanden -> das LETZTE ist das Dezimaltrennzeichen
 *     ("1.234,56" -> 1234,56 · "1,234.56" -> 1234,56)
 *   - nur Komma -> Dezimaltrennzeichen ("12,5" -> 12,50)
 *   - nur Punkt -> Tausendertrennzeichen, wenn genau drei Ziffern folgen und
 *     davor nicht bloss eine 0 steht ("1.500" -> 1500,00 · "12.50" -> 12,50
 *     · "0.750" -> 0,75)
 */
export function parseAmount(input: string): Cents | null {
  if (typeof input !== 'string') return null;

  const cleaned = input
    .replace(/[\s  ]/g, '')
    .replace(/[€$£]/g, '')
    .trim();
  if (cleaned === '') return null;

  const negative = cleaned.startsWith('-');
  const body = cleaned.replace(/^[+-]/, '');
  if (!/^[\d.,]+$/.test(body)) return null;

  const lastComma = body.lastIndexOf(',');
  const lastDot = body.lastIndexOf('.');

  let normalized: string;
  if (lastComma !== -1 && lastDot !== -1) {
    const decimalAt = Math.max(lastComma, lastDot);
    normalized =
      body.slice(0, decimalAt).replace(/[.,]/g, '') + '.' + body.slice(decimalAt + 1);
  } else if (lastComma !== -1) {
    normalized = body.slice(0, lastComma).replace(/\./g, '') + '.' + body.slice(lastComma + 1);
  } else if (lastDot !== -1) {
    const before = body.slice(0, lastDot);
    const after = body.slice(lastDot + 1);
    const isGrouping = after.length === 3 && before !== '' && before !== '0';
    normalized = isGrouping ? before + after : before + '.' + after;
  } else {
    normalized = body;
  }

  // Mehrere Trennzeichen im Dezimalteil bedeuten Unsinn wie "1,2,3".
  if ((normalized.match(/\./g) ?? []).length > 1) return null;

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;

  const cents = Math.round(value * 100);
  if (!Number.isFinite(cents) || Math.abs(cents) > MAX_CENTS) return null;

  return negative ? -cents : cents;
}

export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

/** Anteil in Prozent, 0 wenn die Gesamtsumme 0 ist. */
export function percentOf(part: Cents, total: Cents): number {
  if (total === 0) return 0;
  return (part / total) * 100;
}
