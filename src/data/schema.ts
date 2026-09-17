import { z } from 'zod';
import { CATEGORY_SCALES } from './colorScales';
import { MAX_CENTS } from '@/lib/money';

/** Wird in jeden Export geschrieben. Steigt, sobald sich die Form der
 *  Daten aendert - migrations.ts haengt daran. */
export const SCHEMA_VERSION = 1;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum muss YYYY-MM-DD sein');

const timestamp = z.string().min(1);

/** Vier Felder, die alle Datensaetze teilen.
 *
 *  Sie kosten heute fast nichts und sind die Voraussetzung dafuer, spaeter
 *  eine Datenbank anzubinden, ohne die Daten zu migrieren:
 *    id        - kollisionsfrei ueber Geraete hinweg
 *    updatedAt - Konfliktaufloesung (juengster Schreibvorgang gewinnt)
 *    deletedAt - weiches Loeschen; ohne das kann eine Loeschung nicht
 *                synchronisiert werden, der Eintrag taucht wieder auf
 */
const baseRecord = {
  id: z.string().min(1),
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: timestamp.nullable(),
};

const amountCents = z
  .number()
  .int('Betrag muss in ganzen Cent vorliegen')
  .positive('Betrag muss groesser als 0 sein')
  .max(MAX_CENTS);

// --------------------------------------------------------------- Kategorie

export const categorySchema = z.object({
  ...baseRecord,
  name: z.string().min(1).max(60),
  color: z.enum(CATEGORY_SCALES),
  icon: z.string().min(1),
  /** Mit der App ausgeliefert. Umbenennen und Umfaerben ist erlaubt - das Flag
   *  dient nur dazu, beim Import eigene von mitgelieferten Kategorien zu trennen. */
  isDefault: z.boolean(),
  /** Archiviert statt geloescht: bestehende Ausgaben behalten ihre Kategorie,
   *  sie taucht nur in der Auswahl nicht mehr auf. */
  archivedAt: timestamp.nullable(),
});

export type Category = z.infer<typeof categorySchema>;

// ------------------------------------------------------- Variable Ausgabe

export const variableExpenseSchema = z.object({
  ...baseRecord,
  date: isoDate,
  categoryId: z.string().min(1),
  amountCents,
  note: z.string().max(280),
});

export type VariableExpense = z.infer<typeof variableExpenseSchema>;

// ----------------------------------------------------------- Fixe Ausgabe

export const RECURRENCE_INTERVALS = [
  'weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'yearly',
] as const;

export type RecurrenceInterval = (typeof RECURRENCE_INTERVALS)[number];

export const INTERVAL_LABELS: Record<RecurrenceInterval, string> = {
  weekly: 'Wöchentlich',
  biweekly: '2-wöchentlich',
  monthly: 'Monatlich',
  quarterly: 'Quartalsweise',
  semiannual: 'Halbjährlich',
  yearly: 'Jährlich',
};

export const fixedExpenseSchema = z.object({
  ...baseRecord,
  interval: z.enum(RECURRENCE_INTERVALS),
  categoryId: z.string().min(1),
  amountCents,
  /** Bei monatlich und laenger: Tag im Monat (1-31).
   *  Bei woechentlich und 2-woechentlich: Wochentag (1 = Montag .. 7 = Sonntag).
   *  Die Doppelbedeutung ist bewusst - ein zweites Feld waere in 5 von 6
   *  Faellen leer. */
  dueDay: z.number().int().min(1).max(31),
  note: z.string().max(280),
  startDate: isoDate,
  /** Gesetzt = beendet. Die Historie bleibt dadurch korrekt, statt dass
   *  vergangene Monate ploetzlich guenstiger aussehen. */
  endDate: isoDate.nullable(),
});

export type FixedExpense = z.infer<typeof fixedExpenseSchema>;

// -------------------------------------------------------------- Einstellungen

export const settingsSchema = z.object({
  /** Demo-Daten sind geladen. Steuert das Badge und "Demo-Daten löschen". */
  demoDataLoaded: z.boolean(),
  /** Einmaliger Backup-Hinweis wurde gezeigt. */
  backupHintSeenAt: timestamp.nullable(),
  /** iOS-Installationshinweis wurde weggeklickt. */
  installHintDismissedAt: timestamp.nullable(),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  demoDataLoaded: false,
  backupHintSeenAt: null,
  installHintDismissedAt: null,
};

// -------------------------------------------------------------------- Export

export const exportBundleSchema = z.object({
  schemaVersion: z.number().int().positive(),
  exportedAt: timestamp,
  app: z.literal('money-month').optional(),
  categories: z.array(categorySchema),
  variableExpenses: z.array(variableExpenseSchema),
  fixedExpenses: z.array(fixedExpenseSchema),
  settings: settingsSchema.optional(),
});

export type ExportBundle = z.infer<typeof exportBundleSchema>;

// ------------------------------------------------------------------ Helfer

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  // randomUUID braucht einen sicheren Kontext (https oder localhost).
  // Der Fallback ist nicht kryptografisch, reicht aber fuer lokale IDs.
  try {
    return crypto.randomUUID();
  } catch {
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/** Nicht geloescht und nicht archiviert. */
export function isActiveCategory(c: Category): boolean {
  return c.deletedAt === null && c.archivedAt === null;
}
