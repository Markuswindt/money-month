import { create } from 'zustand';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'mm-theme';

/** Browser-Speicher kann in privaten Fenstern oder bei blockierten
 *  Site-Daten werfen. Ein Theme ist eine Bequemlichkeit - nie ein Grund,
 *  die App abstuerzen zu lassen. */
function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* ignorieren */
  }
  return 'system';
}

function writeStored(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignorieren */
  }
}

function systemTheme(): ResolvedTheme {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function resolve(mode: ThemeMode): ResolvedTheme {
  return mode === 'system' ? systemTheme() : mode;
}

/** Radix Colors liefert die Dunkelwerte unter `.dark`. Die Klasse muss
 *  deshalb exklusiv gesetzt sein - nicht beide gleichzeitig. */
function applyToDocument(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
}

type ThemeState = {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
};

export const useTheme = create<ThemeState>((set) => {
  const mode = readStored();
  return {
    mode,
    resolved: resolve(mode),
    setMode: (next) => {
      writeStored(next);
      const resolved = resolve(next);
      applyToDocument(resolved);
      set({ mode: next, resolved });
    },
  };
});

/** Haelt das Theme im Systemmodus mit der OS-Einstellung synchron.
 *  Einmal beim App-Start aufrufen; gibt eine Aufraeumfunktion zurueck. */
export function watchSystemTheme(): () => void {
  let mql: MediaQueryList;
  try {
    mql = window.matchMedia('(prefers-color-scheme: dark)');
  } catch {
    return () => {};
  }
  const onChange = (): void => {
    const { mode } = useTheme.getState();
    if (mode !== 'system') return;
    const resolved = systemTheme();
    applyToDocument(resolved);
    useTheme.setState({ resolved });
  };
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}
