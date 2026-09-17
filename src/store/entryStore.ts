import { create } from 'zustand';
import type { FixedExpense, VariableExpense } from '@/data/schema';

export type EntryMode = 'variable' | 'fixed';

type EntryState = {
  open: boolean;
  mode: EntryMode;
  editingVariable: VariableExpense | null;
  editingFixed: FixedExpense | null;
  /** Vorauswahl der Kategorie, wenn aus einer Kategorieansicht heraus erfasst wird. */
  presetCategoryId: string | null;

  openNew: (mode?: EntryMode, presetCategoryId?: string) => void;
  editVariable: (expense: VariableExpense) => void;
  editFixed: (expense: FixedExpense) => void;
  close: () => void;
};

export const useEntryStore = create<EntryState>((set) => ({
  open: false,
  mode: 'variable',
  editingVariable: null,
  editingFixed: null,
  presetCategoryId: null,

  openNew: (mode = 'variable', presetCategoryId) =>
    set({
      open: true,
      mode,
      editingVariable: null,
      editingFixed: null,
      presetCategoryId: presetCategoryId ?? null,
    }),

  editVariable: (expense) =>
    set({ open: true, mode: 'variable', editingVariable: expense, editingFixed: null, presetCategoryId: null }),

  editFixed: (expense) =>
    set({ open: true, mode: 'fixed', editingFixed: expense, editingVariable: null, presetCategoryId: null }),

  close: () => set({ open: false }),
}));
