import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import { LayoutGrid, Plus, Receipt, Repeat, Settings } from 'lucide-react';
import s from './AppShell.module.css';

const TABS = [
  { to: '/', label: 'Übersicht', Icon: LayoutGrid, end: true },
  { to: '/ausgaben', label: 'Ausgaben', Icon: Receipt, end: false },
  { to: '/fixkosten', label: 'Fixkosten', Icon: Repeat, end: false },
  { to: '/mehr', label: 'Mehr', Icon: Settings, end: false },
] as const;

/**
 * Mobil eine Tab-Leiste am unteren Rand, ab Desktop eine Seitenleiste.
 *
 * Unten, weil dort der Daumen liegt. Der Plus-Knopf schwebt darueber rechts:
 * Erfassen ist die mit Abstand haeufigste Handlung und darf nie mehr als
 * einen Tipp entfernt sein.
 */
export function AppShell({ children, onAdd }: { children: ReactNode; onAdd: () => void }) {
  // Unter "Mehr" wird nichts erfasst - dort verdeckt der Knopf nur Inhalt.
  const showAdd = !useLocation().pathname.startsWith('/mehr');

  return (
    <div className={s.shell}>
      <nav className={s.tabBar} aria-label="Hauptnavigation">
        <span className={s.brand}>Money&gt;Month</span>
        {TABS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => (isActive ? `${s.tab} ${s.tabActive}` : s.tab)}
          >
            <Icon size={20} strokeWidth={1.75} aria-hidden />
            {label}
          </NavLink>
        ))}
        {showAdd && (
          <button type="button" className={s.fab} onClick={onAdd} aria-label="Ausgabe erfassen">
            <Plus size={24} strokeWidth={2} aria-hidden />
            <span className={s.fabLabel}>Erfassen</span>
          </button>
        )}
      </nav>

      <main className={s.main}>{children}</main>
    </div>
  );
}
