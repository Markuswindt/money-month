import { create } from 'zustand';
import { localRepository } from '@/data/localRepo';
import type { ExpenseRepository, Snapshot } from '@/data/repository';
import {
  DEFAULT_SETTINGS, nowIso, newId,
  type Category, type FixedExpense, type Settings, type VariableExpense,
} from '@/data/schema';
import { buildSeedData } from '@/data/seed';
import { nextFreeScale, type ColorScale } from '@/data/colorScales';

export type Status = 'loading' | 'ready' | 'error';

/** Was zuletzt geloescht wurde - Grundlage des "Rückgängig"-Toasts.
 *  Ein Bestaetigungsdialog vor jedem Loeschen waere im Normalfall
 *  langsamer und im Fehlerfall nicht sicherer. */
export type Undoable =
  | { kind: 'variable'; record: VariableExpense }
  | { kind: 'fixed'; record: FixedExpense };

type DataState = {
  status: Status;
  error: string | null;
  categories: Category[];
  variableExpenses: VariableExpense[];
  fixedExpenses: FixedExpense[];
  settings: Settings;
  lastDeleted: Undoable | null;

  init: () => Promise<void>;

  addVariable: (input: NewVariableInput) => Promise<VariableExpense>;
  updateVariable: (id: string, patch: Partial<NewVariableInput>) => Promise<void>;
  deleteVariable: (id: string) => Promise<void>;

  addFixed: (input: NewFixedInput) => Promise<FixedExpense>;
  updateFixed: (id: string, patch: Partial<NewFixedInput>) => Promise<void>;
  deleteFixed: (id: string) => Promise<void>;
  endFixed: (id: string, endDate: string) => Promise<void>;

  addCategory: (name: string, color?: ColorScale, icon?: string) => Promise<Category>;
  updateCategory: (id: string, patch: Partial<Pick<Category, 'name' | 'color' | 'icon'>>) => Promise<void>;
  setCategoryArchived: (id: string, archived: boolean) => Promise<void>;

  undoDelete: () => Promise<void>;
  clearUndo: () => void;

  loadDemoData: () => Promise<void>;
  clearAll: () => Promise<void>;
  replaceAll: (snapshot: Omit<Snapshot, 'settings'> & { settings?: Settings }) => Promise<void>;
  mergeImport: (incoming: Omit<Snapshot, 'settings'>) => Promise<{ added: number; updated: number }>;
  patchSettings: (patch: Partial<Settings>) => Promise<void>;
};

export type NewVariableInput = {
  date: string;
  categoryId: string;
  amountCents: number;
  note: string;
};

export type NewFixedInput = {
  interval: FixedExpense['interval'];
  categoryId: string;
  amountCents: number;
  dueDay: number;
  note: string;
  startDate: string;
  endDate: string | null;
};

const repo: ExpenseRepository = localRepository;

function baseNew() {
  const ts = nowIso();
  return { id: newId(), createdAt: ts, updatedAt: ts, deletedAt: null };
}

/** Schreibfehler duerfen die Oberflaeche nicht einfrieren, aber auch nicht
 *  stillschweigend verschluckt werden - sonst glaubt man, gespeichert zu
 *  haben. Der Zustand bleibt stehen, der Fehler wird sichtbar gemacht. */
async function persist(set: (p: Partial<DataState>) => void, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    set({ error: e instanceof Error ? e.message : 'Speichern fehlgeschlagen' });
  }
}

export const useDataStore = create<DataState>((set, get) => ({
  status: 'loading',
  error: null,
  categories: [],
  variableExpenses: [],
  fixedExpenses: [],
  settings: DEFAULT_SETTINGS,
  lastDeleted: null,

  async init() {
    try {
      const snapshot = await repo.load();
      // Erster Start: Demo-Daten laden, damit sofort etwas zu sehen ist.
      if (snapshot.categories.length === 0) {
        const seed = buildSeedData();
        const settings: Settings = { ...DEFAULT_SETTINGS, demoDataLoaded: true };
        await Promise.all([
          repo.putManyCategories(seed.categories),
          repo.putManyFixed(seed.fixedExpenses),
          repo.putManyVariable(seed.variableExpenses),
          repo.saveSettings(settings),
        ]);
        set({
          status: 'ready',
          categories: seed.categories,
          fixedExpenses: seed.fixedExpenses,
          variableExpenses: seed.variableExpenses,
          settings,
        });
        return;
      }
      set({ status: 'ready', ...snapshot });
    } catch (e) {
      set({
        status: 'error',
        error: e instanceof Error ? e.message : 'Daten konnten nicht geladen werden',
      });
    }
  },

  // ------------------------------------------------------ variable Ausgaben

  async addVariable(input) {
    const record: VariableExpense = { ...baseNew(), ...input };
    set({ variableExpenses: [...get().variableExpenses, record] });
    await persist(set, () => repo.putVariable(record));
    return record;
  },

  async updateVariable(id, patch) {
    const existing = get().variableExpenses.find((e) => e.id === id);
    if (!existing) return;
    const updated: VariableExpense = { ...existing, ...patch, updatedAt: nowIso() };
    set({ variableExpenses: get().variableExpenses.map((e) => (e.id === id ? updated : e)) });
    await persist(set, () => repo.putVariable(updated));
  },

  async deleteVariable(id) {
    const existing = get().variableExpenses.find((e) => e.id === id);
    if (!existing) return;
    const deleted: VariableExpense = { ...existing, deletedAt: nowIso(), updatedAt: nowIso() };
    set({
      variableExpenses: get().variableExpenses.map((e) => (e.id === id ? deleted : e)),
      lastDeleted: { kind: 'variable', record: existing },
    });
    await persist(set, () => repo.putVariable(deleted));
  },

  // ---------------------------------------------------------- Fixkosten

  async addFixed(input) {
    const record: FixedExpense = { ...baseNew(), ...input };
    set({ fixedExpenses: [...get().fixedExpenses, record] });
    await persist(set, () => repo.putFixed(record));
    return record;
  },

  async updateFixed(id, patch) {
    const existing = get().fixedExpenses.find((f) => f.id === id);
    if (!existing) return;
    const updated: FixedExpense = { ...existing, ...patch, updatedAt: nowIso() };
    set({ fixedExpenses: get().fixedExpenses.map((f) => (f.id === id ? updated : f)) });
    await persist(set, () => repo.putFixed(updated));
  },

  async deleteFixed(id) {
    const existing = get().fixedExpenses.find((f) => f.id === id);
    if (!existing) return;
    const deleted: FixedExpense = { ...existing, deletedAt: nowIso(), updatedAt: nowIso() };
    set({
      fixedExpenses: get().fixedExpenses.map((f) => (f.id === id ? deleted : f)),
      lastDeleted: { kind: 'fixed', record: existing },
    });
    await persist(set, () => repo.putFixed(deleted));
  },

  /** Beenden statt loeschen: vergangene Monate behalten ihre Kosten. */
  async endFixed(id, endDate) {
    await get().updateFixed(id, { endDate });
  },

  // ---------------------------------------------------------- Kategorien

  async addCategory(name, color, icon) {
    const used = get().categories.map((c) => c.color);
    const record: Category = {
      ...baseNew(),
      name: name.trim(),
      color: color ?? nextFreeScale(used),
      icon: icon ?? 'Tag',
      isDefault: false,
      archivedAt: null,
    };
    set({ categories: [...get().categories, record] });
    await persist(set, () => repo.putCategory(record));
    return record;
  },

  async updateCategory(id, patch) {
    const existing = get().categories.find((c) => c.id === id);
    if (!existing) return;
    const updated: Category = { ...existing, ...patch, updatedAt: nowIso() };
    set({ categories: get().categories.map((c) => (c.id === id ? updated : c)) });
    await persist(set, () => repo.putCategory(updated));
  },

  /** Archivieren statt loeschen: bestehende Ausgaben behalten ihre
   *  Kategorie, sie taucht nur in der Auswahl nicht mehr auf. */
  async setCategoryArchived(id, archived) {
    const existing = get().categories.find((c) => c.id === id);
    if (!existing) return;
    const updated: Category = {
      ...existing,
      archivedAt: archived ? nowIso() : null,
      updatedAt: nowIso(),
    };
    set({ categories: get().categories.map((c) => (c.id === id ? updated : c)) });
    await persist(set, () => repo.putCategory(updated));
  },

  // --------------------------------------------------------------- Undo

  async undoDelete() {
    const last = get().lastDeleted;
    if (!last) return;
    const restored = { ...last.record, deletedAt: null, updatedAt: nowIso() };
    if (last.kind === 'variable') {
      const rec = restored as VariableExpense;
      set({
        variableExpenses: get().variableExpenses.map((e) => (e.id === rec.id ? rec : e)),
        lastDeleted: null,
      });
      await persist(set, () => repo.putVariable(rec));
    } else {
      const rec = restored as FixedExpense;
      set({
        fixedExpenses: get().fixedExpenses.map((f) => (f.id === rec.id ? rec : f)),
        lastDeleted: null,
      });
      await persist(set, () => repo.putFixed(rec));
    }
  },

  clearUndo() {
    set({ lastDeleted: null });
  },

  // ------------------------------------------------------ Datenverwaltung

  async loadDemoData() {
    const seed = buildSeedData();
    await get().replaceAll({
      categories: seed.categories,
      fixedExpenses: seed.fixedExpenses,
      variableExpenses: seed.variableExpenses,
      settings: { ...get().settings, demoDataLoaded: true },
    });
  },

  async clearAll() {
    await persist(set, () => repo.clear());
    const seed = buildSeedData();
    // Ohne Kategorien laesst sich nichts erfassen - die Vorgabekategorien
    // bleiben deshalb auch nach dem Leeren bestehen.
    const settings: Settings = { ...DEFAULT_SETTINGS, demoDataLoaded: false };
    await persist(set, async () => {
      await repo.putManyCategories(seed.categories);
      await repo.saveSettings(settings);
    });
    set({
      categories: seed.categories,
      variableExpenses: [],
      fixedExpenses: [],
      settings,
      lastDeleted: null,
    });
  },

  async replaceAll(snapshot) {
    const settings = snapshot.settings ?? get().settings;
    await persist(set, async () => {
      await repo.clear();
      await repo.putManyCategories(snapshot.categories);
      await repo.putManyFixed(snapshot.fixedExpenses);
      await repo.putManyVariable(snapshot.variableExpenses);
      await repo.saveSettings(settings);
    });
    set({
      categories: snapshot.categories,
      fixedExpenses: snapshot.fixedExpenses,
      variableExpenses: snapshot.variableExpenses,
      settings,
      lastDeleted: null,
    });
  },

  /** Zusammenfuehren nach id. Bei Konflikt gewinnt der juengere Stand -
   *  dieselbe Regel, die spaeter auch die Geraete-Synchronisation nutzt. */
  async mergeImport(incoming) {
    const state = get();
    let added = 0;
    let updated = 0;

    function merge<T extends { id: string; updatedAt: string }>(
      current: T[],
      next: readonly T[],
    ): T[] {
      const byId = new Map(current.map((r) => [r.id, r]));
      for (const rec of next) {
        const existing = byId.get(rec.id);
        if (!existing) {
          byId.set(rec.id, rec);
          added++;
        } else if (rec.updatedAt > existing.updatedAt) {
          byId.set(rec.id, rec);
          updated++;
        }
      }
      return [...byId.values()];
    }

    const categories = merge(state.categories, incoming.categories);
    const fixedExpenses = merge(state.fixedExpenses, incoming.fixedExpenses);
    const variableExpenses = merge(state.variableExpenses, incoming.variableExpenses);

    set({ categories, fixedExpenses, variableExpenses });
    await persist(set, async () => {
      await repo.putManyCategories(categories);
      await repo.putManyFixed(fixedExpenses);
      await repo.putManyVariable(variableExpenses);
    });
    return { added, updated };
  },

  async patchSettings(patch) {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    await persist(set, () => repo.saveSettings(settings));
  },
}));
