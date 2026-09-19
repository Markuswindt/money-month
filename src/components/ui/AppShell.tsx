import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { LayoutGrid, Plus, Receipt, Repeat, Settings } from 'lucide-react';
import s from './AppShell.module.css';

const TABS = [
  { to: '/', label: 'Übersicht', Icon: LayoutGrid, end: true },
  { to: '/ausgaben', label: 'Ausgaben', Icon: Receipt, end: false },
  { to: '/fixkosten', label: 'Fixkosten', Icon: Repeat, end: false },
  { to: '/mehr', label: 'Mehr', Icon: Settings, end: false },
] as const;

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

/**
 * Mobil zwei getrennte schwebende Pillen am unteren Rand, ab Desktop eine
 * Seitenleiste.
 *
 * Unten, weil dort der Daumen liegt. Der Plus-Knopf ist bewusst eine eigene
 * Flaeche links, nicht Teil der Tab-Pille rechts: Erfassen ist die mit
 * Abstand haeufigste Handlung und soll sich schon durch seine eigene Form
 * von der Navigation abheben, nicht nur durch die Farbe.
 */
export function AppShell({ children, onAdd }: { children: ReactNode; onAdd: () => void }) {
  return (
    <div className={s.shell}>
      <nav className={s.navRow} aria-label="Hauptnavigation">
        <span className={s.brand}>Money&gt;Month</span>

        <button
          type="button"
          className={s.fab}
          onClick={onAdd}
          aria-label="Ausgabe erfassen"
        >
          <Plus size={24} strokeWidth={2} aria-hidden />
          <span className={s.fabLabel}>Erfassen</span>
        </button>

        <div className={s.tabPill}>
          {TABS.map((tab) => <TabLink key={tab.to} {...tab} />)}
        </div>
      </nav>

      <main className={s.main}>{children}</main>
    </div>
  );
}
