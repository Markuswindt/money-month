import type { Category, FixedExpense, Settings, VariableExpense } from './schema';

export type Snapshot = {
  categories: Category[];
  variableExpenses: VariableExpense[];
  fixedExpenses: FixedExpense[];
  settings: Settings;
};

export type RecordKind = 'category' | 'variable' | 'fixed';

/**
 * DER AUSTAUSCHPUNKT.
 *
 * Heute steckt dahinter IndexedDB, spaeter eine echte Datenbank. Jede
 * Methode ist deshalb asynchron - auch dort, wo das lokal unnoetig waere.
 * Genau das erspart beim Umstieg das Umschreiben der ganzen App von
 * synchron auf asynchron.
 *
 * Geloescht wird ausschliesslich weich (deletedAt). Ein hartes Delete
 * liesse sich spaeter nicht synchronisieren: das andere Geraet kennt den
 * Datensatz noch und wuerde ihn zurueckspielen.
 */
export interface ExpenseRepository {
  /** Laedt den kompletten Bestand. Die App haelt ihn im Speicher -
   *  bei realistischen Datenmengen (wenige tausend Eintraege) ist das
   *  schneller und einfacher als Abfragen pro Ansicht. */
  load(): Promise<Snapshot>;

  putCategory(category: Category): Promise<void>;
  putVariable(expense: VariableExpense): Promise<void>;
  putFixed(expense: FixedExpense): Promise<void>;

  putManyCategories(categories: readonly Category[]): Promise<void>;
  putManyVariable(expenses: readonly VariableExpense[]): Promise<void>;
  putManyFixed(expenses: readonly FixedExpense[]): Promise<void>;

  saveSettings(settings: Settings): Promise<void>;

  /** Entfernt alles unwiderruflich. Nur fuer "Demo-Daten löschen" und
   *  fuer den Import mit "ersetzen". */
  clear(): Promise<void>;
}
