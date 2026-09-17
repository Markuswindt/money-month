import type { ColorScale } from './colorScales';

export type DefaultCategory = {
  /** Feste ID. Darf sich nie aendern - Seed-Daten, Exporte und die
   *  spaetere Datenbank haengen daran. */
  id: string;
  name: string;
  color: ColorScale;
  /** Name aus lucide-react, aufgeloest in components/ui/CategoryIcon. */
  icon: string;
};

export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { id: 'cat-reisen',         name: 'Reisen',                     color: 'cyan',    icon: 'Plane' },
  { id: 'cat-restaurant',     name: 'Restaurant & Lieferservice',  color: 'orange',  icon: 'UtensilsCrossed' },
  { id: 'cat-bar',            name: 'Bar & Alkohol',               color: 'plum',    icon: 'Martini' },
  { id: 'cat-lebensmittel',   name: 'Lebensmittel',                color: 'grass',   icon: 'ShoppingCart' },
  { id: 'cat-transport',      name: 'Transport',                   color: 'blue',    icon: 'Bus' },
  { id: 'cat-unterhaltung',   name: 'Unterhaltung & Freizeit',     color: 'violet',  icon: 'Clapperboard' },
  { id: 'cat-kleidung',       name: 'Kleidung',                    color: 'pink',    icon: 'Shirt' },
  { id: 'cat-gesundheit',     name: 'Gesundheit & Körperpflege',   color: 'teal',    icon: 'HeartPulse' },
  { id: 'cat-geschenke',      name: 'Geschenke',                   color: 'crimson', icon: 'Gift' },
  { id: 'cat-nebenkosten',    name: 'Nebenkosten',                 color: 'yellow',  icon: 'Zap' },
  { id: 'cat-wohnen',         name: 'Wohnen',                      color: 'brown',   icon: 'House' },
  { id: 'cat-sport',          name: 'Sport',                       color: 'lime',    icon: 'Dumbbell' },
  { id: 'cat-drogen',         name: 'Drogen',                      color: 'purple',  icon: 'Pill' },
  { id: 'cat-versicherungen', name: 'Versicherungen',              color: 'indigo',  icon: 'ShieldCheck' },
] as const;
