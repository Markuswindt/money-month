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
// Links/rechts der Luecke fuer den FAB - zwei plus zwei, damit der Knopf
// mittig zwischen "Ausgaben" und "Fixkosten" auftaucht.
const LEFT_TABS = TABS.slice(0, 2);
const RIGHT_TABS = TABS.slice(2);

function TabLink({ to, label, Icon, end }: (typeof TABS)[number]) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => (isActive ? `${s.tab} ${s.tabActive}` : s.tab)}
    >
      <Icon size={20} strokeWidth={1.75} aria-hidden />
      {label}
    </NavLink>
  );
}

export function AppShell({ children, onAdd }: { children: ReactNode; onAdd: () => void }) {
  // Unter "Mehr" wird nichts erfasst - dort verdeckt der Knopf nur Inhalt.
  const showAdd = !useLocation().pathname.startsWith('/mehr');

  return (
    <div className={s.shell}>
      <nav className={s.tabBar} aria-label="Hauptnavigation">
        <span className={s.brand}>Money&gt;Month</span>
        <div className={s.tabGroup}>
          {LEFT_TABS.map((tab) => <TabLink key={tab.to} {...tab} />)}
        </div>

        {/* Leerer Slot bleibt bestehen, auch wenn der Knopf ausgeblendet
            ist - sonst ruecken die Tab-Gruppen beim Wechsel zu "Mehr"
            zusammen und die Breiten springen. */}
        <div className={s.fabSlot}>
          {showAdd && (
            <button type="button" className={s.fab} onClick={onAdd} aria-label="Ausgabe erfassen">
              <Plus size={24} strokeWidth={2} aria-hidden />
              <span className={s.fabLabel}>Erfassen</span>
            </button>
          )}
        </div>

        <div className={s.tabGroup}>
          {RIGHT_TABS.map((tab) => <TabLink key={tab.to} {...tab} />)}
        </div>
      </nav>

      <main className={s.main}>{children}</main>
    </div>
  );
}
