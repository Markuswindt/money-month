import {
  exportBundleSchema, INTERVAL_LABELS, SCHEMA_VERSION,
  type Category, type ExportBundle, type FixedExpense, type Settings, type VariableExpense,
} from './schema';
import { formatDecimal, formatMoney } from '@/lib/money';
import {
  formatFullDate, periodLabel, type Period,
} from '@/lib/periods';
import { categoryRanking, periodTotals, type Dataset } from '@/lib/aggregations';

export type CsvDialect = 'de' | 'international';

type Source = {
  categories: readonly Category[];
  variableExpenses: readonly VariableExpense[];
  fixedExpenses: readonly FixedExpense[];
  settings?: Settings;
};

/** Nur lebende Datensaetze exportieren - ein Backup soll den Zustand
 *  abbilden, nicht den Papierkorb. */
function alive<T extends { deletedAt: string | null }>(items: readonly T[]): T[] {
  return items.filter((i) => i.deletedAt === null);
}

export function buildExportBundle(source: Source): ExportBundle {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'money-month',
    categories: alive(source.categories),
    variableExpenses: alive(source.variableExpenses),
    fixedExpenses: alive(source.fixedExpenses),
    ...(source.settings ? { settings: source.settings } : {}),
  };
}

export function toJson(bundle: ExportBundle): string {
  return JSON.stringify(bundle, null, 2);
}

function csvCell(value: string, separator: string): string {
  // Anfuehrungszeichen verdoppeln, Zelle einpacken, wenn sie Trenn- oder
  // Steuerzeichen enthaelt - sonst zerreisst ein Komma in der Notiz die Zeile.
  const needsQuotes = value.includes(separator) || value.includes('"') || /[\r\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

/**
 * CSV fuer Excel und Numbers.
 *
 * Der deutsche Dialekt nutzt Semikolon als Trenner und Komma als
 * Dezimalzeichen - deutsches Excel erwartet genau das. Dazu ein BOM:
 * ohne das zerlegt Excel jeden Umlaut.
 */
export function toCsv(source: Source, dialect: CsvDialect = 'de'): string {
  const sep = dialect === 'de' ? ';' : ',';
  const names = new Map(source.categories.map((c) => [c.id, c.name]));
  const amount = (cents: number) =>
    dialect === 'de' ? formatDecimal(cents).replace(/\./g, '') : (cents / 100).toFixed(2);

  const header = [
    'typ', 'datum', 'kategorie', 'betrag_eur', 'notiz',
    'intervall', 'abbuchungstag', 'startdatum', 'enddatum',
  ];

  const rows: string[][] = [];
  for (const e of alive(source.variableExpenses)) {
    rows.push([
      'variabel', e.date, names.get(e.categoryId) ?? e.categoryId,
      amount(e.amountCents), e.note, '', '', '', '',
    ]);
  }
  for (const f of alive(source.fixedExpenses)) {
    rows.push([
      'fix', '', names.get(f.categoryId) ?? f.categoryId,
      amount(f.amountCents), f.note,
      INTERVAL_LABELS[f.interval], String(f.dueDay), f.startDate, f.endDate ?? '',
    ]);
  }
  rows.sort((a, b) => (a[1] ?? '').localeCompare(b[1] ?? ''));

  const lines = [header, ...rows].map((cols) =>
    cols.map((c) => csvCell(c, sep)).join(sep),
  );

  // "sep=;" sagt Excel den Trenner, bevor es raet.
  const prefix = dialect === 'de' ? `sep=${sep}\r\n` : '';
  // BOM: ohne ihn liest Excel UTF-8 als Latin-1 und zerlegt die Umlaute.
  return `﻿${prefix}${lines.join('\r\n')}\r\n`;
}

/** Monatsbericht zum Teilen. Bewusst kein Datenformat - er ist zum Lesen
 *  gedacht und nicht dafuer, wieder eingelesen zu werden. */
export function toMarkdownReport(
  dataset: Dataset,
  period: Period,
  categories: readonly Category[],
): string {
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const totals = periodTotals(dataset, period);
  const rows = categoryRanking(dataset, period);

  const lines: string[] = [
    `# Ausgaben ${periodLabel(period)}`,
    '',
    `**Gesamt: ${formatMoney(totals.totalCents)}**`,
    '',
    `- Fixkosten: ${formatMoney(totals.fixedCents)}`,
    `- Variabel: ${formatMoney(totals.variableCents)}`,
    '',
    '## Nach Kategorie',
    '',
    '| Kategorie | Betrag | Anteil |',
    '| --- | ---: | ---: |',
  ];
  for (const row of rows) {
    lines.push(
      `| ${names.get(row.categoryId) ?? row.categoryId} | ${formatMoney(row.cents)} | ${row.share.toFixed(0)} % |`,
    );
  }
  lines.push('', `_Erstellt am ${formatFullDate(new Date().toISOString().slice(0, 10))} mit Money>Month._`, '');
  return lines.join('\n');
}

export type ImportResult =
  | { ok: true; bundle: ExportBundle }
  | { ok: false; error: string };

export function parseImport(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Die Datei ist kein gültiges JSON.' };
  }

  const parsed = exportBundleSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: first
        ? `Die Datei passt nicht zum Format: ${first.path.join('.') || 'Wurzel'} — ${first.message}`
        : 'Die Datei passt nicht zum erwarteten Format.',
    };
  }
  if (parsed.data.schemaVersion > SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Die Datei stammt aus einer neueren Version (${parsed.data.schemaVersion}). Bitte die App aktualisieren.`,
    };
  }
  return { ok: true, bundle: parsed.data };
}

/**
 * Datei ausliefern.
 *
 * In einer vom Home-Bildschirm gestarteten PWA loest iOS `<a download>`
 * unzuverlaessig aus - ueber das Teilen-Blatt landet die Datei dagegen
 * direkt in Dateien, iCloud oder Mail. Deshalb zuerst Web Share, sonst
 * der klassische Download.
 */
export async function saveFile(
  filename: string,
  mimeType: string,
  content: string,
): Promise<'shared' | 'downloaded'> {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });

  const file = new File([blob], filename, { type: mimeType });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof navigator.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch {
      // Abbruch durch den Nutzer oder nicht erlaubt: auf Download zurueckfallen.
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Sofortiges revoke kann den Download in Safari abbrechen.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

export function timestampedName(base: string, extension: string): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${base}-${stamp}.${extension}`;
}
