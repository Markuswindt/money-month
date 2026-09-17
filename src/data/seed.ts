import { addDays, differenceInCalendarDays, getDay } from 'date-fns';
import { DEFAULT_CATEGORIES } from './defaultCategories';
import type { Category, FixedExpense, RecurrenceInterval, VariableExpense } from './schema';
import { fromIsoDate, toIsoDate, todayIso } from '@/lib/periods';

/** Deterministischer Zufall (mulberry32). Gleicher Seed, gleiche Daten -
 *  sonst sieht die App bei jedem Setup anders aus und Screenshots,
 *  Fehlerberichte und Tests lassen sich nicht vergleichen. */
function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 20260917;
const START_DATE = '2026-03-01';

type Profile = {
  categoryId: string;
  /** Wahrscheinlichkeit pro Tag. */
  p: number;
  /** Faktor fuer Freitag bis Sonntag. */
  weekendBoost?: number;
  /** Betragsspanne in Cent. */
  min: number;
  max: number;
  notes: readonly string[];
};

/** Die Verteilung ist der ganze Punkt: Lebensmittel oft und klein, Reisen
 *  selten und gross, Restaurant und Bar mit Wochenendspitzen. Gleichverteilte
 *  Zufallsdaten wuerden jedes Chart flach und jede Kategorie gleich gross
 *  aussehen lassen - man saehe nicht, ob die Darstellung taugt. */
const PROFILES: readonly Profile[] = [
  { categoryId: 'cat-lebensmittel', p: 0.34, min: 850, max: 7200,
    notes: ['Rewe', 'Edeka', 'Wocheneinkauf', 'Aldi', 'Bäckerei', 'Markt', 'Getränke'] },
  { categoryId: 'cat-restaurant', p: 0.2, weekendBoost: 1.9, min: 950, max: 6800,
    notes: ['Mittagessen', 'Lieferando', 'Pizzeria', 'Sushi', 'Imbiss', 'Brunch', 'Thai'] },
  { categoryId: 'cat-bar', p: 0.09, weekendBoost: 3.2, min: 650, max: 5400,
    notes: ['Feierabendbier', 'Cocktailbar', 'Weinbar', 'Kneipe', 'Spätkauf'] },
  { categoryId: 'cat-transport', p: 0.17, min: 280, max: 4200,
    notes: ['Deutschlandticket-Aufpreis', 'Taxi', 'Tanken', 'Bahn', 'Carsharing', 'Parkhaus'] },
  { categoryId: 'cat-unterhaltung', p: 0.075, weekendBoost: 1.6, min: 900, max: 8500,
    notes: ['Kino', 'Konzert', 'Museum', 'Buch', 'Spieleabend', 'Festivalticket'] },
  { categoryId: 'cat-kleidung', p: 0.04, min: 1900, max: 16_500,
    notes: ['Jeans', 'Schuhe', 'Jacke', 'T-Shirts', 'Secondhand'] },
  { categoryId: 'cat-gesundheit', p: 0.05, min: 650, max: 6400,
    notes: ['Apotheke', 'Drogerie', 'Friseur', 'Zuzahlung', 'Physio'] },
  { categoryId: 'cat-geschenke', p: 0.028, min: 1500, max: 9500,
    notes: ['Geburtstag', 'Hochzeit', 'Mitbringsel', 'Einzug'] },
  { categoryId: 'cat-reisen', p: 0.012, min: 8500, max: 78_000,
    notes: ['Flug Lissabon', 'Hotel', 'Ferienwohnung', 'Mietwagen', 'Zugticket Wien'] },
  { categoryId: 'cat-sport', p: 0.04, min: 800, max: 5200,
    notes: ['Kletterhalle', 'Laufschuhe', 'Schwimmbad', 'Tennisplatz'] },
  { categoryId: 'cat-drogen', p: 0.045, min: 750, max: 4800,
    notes: ['Tabak', 'Späti', 'Wochenende'] },
  { categoryId: 'cat-wohnen', p: 0.03, min: 1200, max: 19_500,
    notes: ['IKEA', 'Baumarkt', 'Pflanzen', 'Handtücher', 'Lampe'] },
  { categoryId: 'cat-nebenkosten', p: 0.01, min: 2500, max: 14_000,
    notes: ['Nachzahlung', 'Kaution Zähler'] },
];

type FixedSeed = {
  id: string;
  categoryId: string;
  amountCents: number;
  interval: RecurrenceInterval;
  dueDay: number;
  note: string;
  startDate: string;
};

/** Deckt alle sechs Intervalle ab - sonst bleibt beim Durchklicken
 *  unklar, ob die Amortisierung fuer jedes davon stimmt. */
const FIXED_SEEDS: readonly FixedSeed[] = [
  { id: 'seed-fix-miete',       categoryId: 'cat-wohnen',          amountCents: 95_000, interval: 'monthly',    dueDay: 1,  note: 'Warmmiete',            startDate: '2023-04-01' },
  { id: 'seed-fix-strom',       categoryId: 'cat-nebenkosten',     amountCents:  7_800, interval: 'monthly',    dueDay: 15, note: 'Abschlag Stadtwerke',  startDate: '2023-04-01' },
  { id: 'seed-fix-internet',    categoryId: 'cat-nebenkosten',     amountCents:  3_999, interval: 'monthly',    dueDay: 5,  note: 'Glasfaser 250',        startDate: '2023-05-01' },
  { id: 'seed-fix-handy',       categoryId: 'cat-nebenkosten',     amountCents:  2_499, interval: 'monthly',    dueDay: 8,  note: 'Mobilfunk',            startDate: '2024-02-08' },
  { id: 'seed-fix-fitness',     categoryId: 'cat-sport',           amountCents:  2_990, interval: 'monthly',    dueDay: 1,  note: 'Fitnessstudio',        startDate: '2025-01-01' },
  { id: 'seed-fix-streaming',   categoryId: 'cat-unterhaltung',    amountCents:  2_798, interval: 'monthly',    dueDay: 12, note: 'Streaming & Musik',    startDate: '2024-06-12' },
  { id: 'seed-fix-rundfunk',    categoryId: 'cat-nebenkosten',     amountCents:  5_508, interval: 'quarterly',  dueDay: 15, note: 'Rundfunkbeitrag',      startDate: '2023-05-15' },
  { id: 'seed-fix-kfz',         categoryId: 'cat-versicherungen',  amountCents: 48_600, interval: 'semiannual', dueDay: 1,  note: 'KFZ-Versicherung',     startDate: '2023-07-01' },
  { id: 'seed-fix-hausrat',     categoryId: 'cat-versicherungen',  amountCents: 11_800, interval: 'yearly',     dueDay: 1,  note: 'Hausrat & Haftpflicht', startDate: '2023-01-01' },
  { id: 'seed-fix-gemuese',     categoryId: 'cat-lebensmittel',    amountCents:  2_200, interval: 'weekly',     dueDay: 3,  note: 'Gemüsekiste',          startDate: '2025-09-03' },
  { id: 'seed-fix-reinigung',   categoryId: 'cat-wohnen',          amountCents:  6_000, interval: 'biweekly',   dueDay: 5,  note: 'Reinigungskraft',      startDate: '2025-03-07' },
];

const SEED_TIMESTAMP = '2026-09-17T08:00:00.000Z';

function baseFields(id: string) {
  return { id, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP, deletedAt: null };
}

export function seedCategories(): Category[] {
  return DEFAULT_CATEGORIES.map((c) => ({
    ...baseFields(c.id),
    name: c.name,
    color: c.color,
    icon: c.icon,
    isDefault: true,
    archivedAt: null,
  }));
}

export function seedFixedExpenses(): FixedExpense[] {
  return FIXED_SEEDS.map((f) => ({
    ...baseFields(f.id),
    categoryId: f.categoryId,
    amountCents: f.amountCents,
    interval: f.interval,
    dueDay: f.dueDay,
    note: f.note,
    startDate: f.startDate,
    endDate: null,
  }));
}

export function seedVariableExpenses(endIso: string = todayIso()): VariableExpense[] {
  const random = makeRandom(SEED);
  const start = fromIsoDate(START_DATE);
  const days = Math.max(0, differenceInCalendarDays(fromIsoDate(endIso), start));
  const out: VariableExpense[] = [];

  for (let d = 0; d <= days; d++) {
    const date = addDays(start, d);
    const iso = toIsoDate(date);
    const weekday = getDay(date); // 0 = Sonntag
    const isWeekend = weekday === 0 || weekday === 5 || weekday === 6;

    for (const profile of PROFILES) {
      const chance = profile.p * (isWeekend ? (profile.weekendBoost ?? 1) : 1);
      if (random() >= chance) continue;

      // Quadrierter Zufall: viele kleine Betraege, wenige grosse.
      // Eine Gleichverteilung saehe in jedem Chart unnatuerlich flach aus.
      const skew = random() ** 2;
      const raw = profile.min + skew * (profile.max - profile.min);
      // Auf 10 Cent runden - echte Belege enden selten auf krummen Cent.
      const amountCents = Math.max(profile.min, Math.round(raw / 10) * 10);

      const note = profile.notes[Math.floor(random() * profile.notes.length)] ?? '';

      out.push({
        ...baseFields(`seed-var-${iso}-${profile.categoryId}-${out.length}`),
        date: iso,
        categoryId: profile.categoryId,
        amountCents,
        note,
      });
    }
  }
  return out;
}

export function buildSeedData(endIso?: string) {
  return {
    categories: seedCategories(),
    fixedExpenses: seedFixedExpenses(),
    variableExpenses: seedVariableExpenses(endIso),
  };
}
