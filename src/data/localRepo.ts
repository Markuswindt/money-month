import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Category, FixedExpense, Settings, VariableExpense } from './schema';
import { DEFAULT_SETTINGS, settingsSchema } from './schema';
import type { ExpenseRepository, Snapshot } from './repository';

const DB_NAME = 'money-month';
const DB_VERSION = 1;
const SETTINGS_KEY = 'settings';

interface MoneyMonthDB extends DBSchema {
  categories: { key: string; value: Category };
  variableExpenses: {
    key: string;
    value: VariableExpense;
    indexes: { date: string; categoryId: string };
  };
  fixedExpenses: {
    key: string;
    value: FixedExpense;
    indexes: { categoryId: string };
  };
  meta: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<MoneyMonthDB>> | null = null;

function getDb(): Promise<IDBPDatabase<MoneyMonthDB>> {
  dbPromise ??= openDB<MoneyMonthDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Schrittweise Migration: jeder Block laeuft nur, wenn die vorhandene
      // Datenbank aelter ist. Neue Versionen kommen unten dazu, ohne die
      // bestehenden Bloecke anzufassen.
      if (oldVersion < 1) {
        db.createObjectStore('categories', { keyPath: 'id' });

        const variable = db.createObjectStore('variableExpenses', { keyPath: 'id' });
        variable.createIndex('date', 'date');
        variable.createIndex('categoryId', 'categoryId');

        const fixed = db.createObjectStore('fixedExpenses', { keyPath: 'id' });
        fixed.createIndex('categoryId', 'categoryId');

        db.createObjectStore('meta');
      }
    },
  });
  return dbPromise;
}

async function putAll<T>(
  storeName: 'categories' | 'variableExpenses' | 'fixedExpenses',
  items: readonly T[],
): Promise<void> {
  if (items.length === 0) return;
  const db = await getDb();
  const tx = db.transaction(storeName, 'readwrite');
  // Ein einziger Transaktionsblock statt eines pro Datensatz - beim Laden
  // der Demo-Daten sind das ~270 Schreibvorgaenge auf einmal.
  await Promise.all([
    ...items.map((item) => tx.store.put(item as never)),
    tx.done,
  ]);
}

export const localRepository: ExpenseRepository = {
  async load(): Promise<Snapshot> {
    const db = await getDb();
    const [categories, variableExpenses, fixedExpenses, rawSettings] = await Promise.all([
      db.getAll('categories'),
      db.getAll('variableExpenses'),
      db.getAll('fixedExpenses'),
      db.get('meta', SETTINGS_KEY),
    ]);

    // Gespeicherte Einstellungen koennen aus einer aelteren Version stammen.
    // Scheitert die Validierung, sind Vorgabewerte besser als ein Absturz
    // beim Start - Einstellungen sind ersetzbar, die Ausgaben nicht.
    const parsed = settingsSchema.safeParse(rawSettings);

    return {
      categories,
      variableExpenses,
      fixedExpenses,
      settings: parsed.success ? parsed.data : DEFAULT_SETTINGS,
    };
  },

  async putCategory(category) {
    const db = await getDb();
    await db.put('categories', category);
  },

  async putVariable(expense) {
    const db = await getDb();
    await db.put('variableExpenses', expense);
  },

  async putFixed(expense) {
    const db = await getDb();
    await db.put('fixedExpenses', expense);
  },

  putManyCategories: (categories) => putAll('categories', categories),
  putManyVariable: (expenses) => putAll('variableExpenses', expenses),
  putManyFixed: (expenses) => putAll('fixedExpenses', expenses),

  async saveSettings(settings: Settings) {
    const db = await getDb();
    await db.put('meta', settings, SETTINGS_KEY);
  },

  async clear() {
    const db = await getDb();
    const tx = db.transaction(
      ['categories', 'variableExpenses', 'fixedExpenses', 'meta'],
      'readwrite',
    );
    await Promise.all([
      tx.objectStore('categories').clear(),
      tx.objectStore('variableExpenses').clear(),
      tx.objectStore('fixedExpenses').clear(),
      tx.objectStore('meta').clear(),
      tx.done,
    ]);
  },
};

/**
 * Bittet den Browser, die Daten dauerhaft zu behalten.
 *
 * WebKit raeumt beschreibbaren Speicher nach 7 Tagen ohne Interaktion ab.
 * Vom Home-Bildschirm installierte PWAs sind davon ausgenommen, im normalen
 * Safari-Tab aber nicht. Der Aufruf ist trotzdem kein Ersatz fuer den
 * Export - er senkt nur die Wahrscheinlichkeit, ihn zu brauchen.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function isStoragePersisted(): Promise<boolean> {
  try {
    return (await navigator.storage?.persisted?.()) ?? false;
  } catch {
    return false;
  }
}
