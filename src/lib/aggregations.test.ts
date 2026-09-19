import { describe, expect, it } from 'vitest';
import {
  categoryRanking, deltaToPrevious, distributeRounding, groupByDay,
  periodsWithData, periodTotals, trendSeries, type Dataset,
} from './aggregations';
import { makePeriod } from './periods';
import { fixed, variable } from './testFixtures';

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d);
const september = makePeriod('month', at(2026, 9, 15));

const dataset: Dataset = {
  variable: [
    variable({ date: '2026-09-03', amountCents: 4832, categoryId: 'cat-lebensmittel' }),
    variable({ date: '2026-09-11', amountCents: 1290, categoryId: 'cat-restaurant' }),
    variable({ date: '2026-09-11', amountCents: 750, categoryId: 'cat-bar' }),
    variable({ date: '2026-08-28', amountCents: 9999, categoryId: 'cat-reisen' }),  // andere Periode
    variable({ date: '2026-09-20', amountCents: 5000, categoryId: 'cat-sport', deletedAt: '2026-09-21T10:00:00Z' }),
  ],
  fixed: [
    fixed({ id: 'f1', amountCents: 95_000, interval: 'monthly', categoryId: 'cat-wohnen' }),
    fixed({ id: 'f2', amountCents: 24_000, interval: 'yearly', categoryId: 'cat-versicherungen' }),
  ],
};

describe('periodTotals', () => {
  it('trennt fix und variabel und summiert beides', () => {
    const t = periodTotals(dataset, september);
    expect(t.variableCents).toBe(4832 + 1290 + 750);
    expect(t.fixedCents).toBe(95_000 + 2000); // Jahresbeitrag amortisiert
    expect(t.totalCents).toBe(t.fixedCents + t.variableCents);
  });

  it('laesst geloeschte Ausgaben aus', () => {
    // Der Sport-Eintrag ueber 50 € ist weich geloescht.
    expect(periodTotals(dataset, september).variableCents).not.toContain(5000);
    expect(periodTotals(dataset, september, 'variable').totalCents).toBe(6872);
  });

  it('respektiert den Filter', () => {
    expect(periodTotals(dataset, september, 'fixed').variableCents).toBe(0);
    expect(periodTotals(dataset, september, 'variable').fixedCents).toBe(0);
  });

  it('zaehlt nur Ausgaben innerhalb der Periode', () => {
    // Die Reise vom 28.08. darf im September nicht auftauchen.
    const ids = periodTotals(dataset, september, 'variable').totalCents;
    expect(ids).toBe(6872);
  });
});

describe('distributeRounding', () => {
  it('trifft die Zielsumme exakt', () => {
    const parts = [33.4, 33.3, 33.3];
    expect(distributeRounding(parts, 100).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('gibt den Cent dem groessten Rest', () => {
    expect(distributeRounding([10.9, 10.1], 21)).toEqual([11, 10]);
  });

  it('kommt auch mit zu grossen Abrundungen klar', () => {
    expect(distributeRounding([10.9, 10.9], 21).reduce((a, b) => a + b, 0)).toBe(21);
  });

  it('haelt eine leere Eingabe aus', () => {
    expect(distributeRounding([], 0)).toEqual([]);
  });
});

describe('categoryRanking', () => {
  it('sortiert absteigend nach Betrag', () => {
    const rows = categoryRanking(dataset, september);
    expect(rows[0]?.categoryId).toBe('cat-wohnen');
    expect(rows.map((r) => r.cents)).toEqual([...rows.map((r) => r.cents)].sort((a, b) => b - a));
  });

  it('summiert sich exakt auf die angezeigte Gesamtsumme', () => {
    // Genau hier verliert eine Finanz-App ihr Vertrauen: wenn die Zeilen
    // einen Cent neben der Summe darueber liegen.
    for (const filter of ['all', 'variable', 'fixed'] as const) {
      const total = periodTotals(dataset, september, filter).totalCents;
      const sum = categoryRanking(dataset, september, filter).reduce((s, r) => s + r.cents, 0);
      expect(sum).toBe(total);
    }
  });

  it('summiert sich auch bei krummen Amortisierungen exakt', () => {
    // Drei Positionen, die alle auf Bruchteile eines Cents fallen.
    const awkward: Dataset = {
      variable: [],
      fixed: [
        fixed({ id: 'a', amountCents: 1000, interval: 'weekly', categoryId: 'c1' }),
        fixed({ id: 'b', amountCents: 1000, interval: 'weekly', categoryId: 'c2' }),
        fixed({ id: 'c', amountCents: 1000, interval: 'weekly', categoryId: 'c3' }),
      ],
    };
    const total = periodTotals(awkward, september).totalCents;
    const sum = categoryRanking(awkward, september).reduce((s, r) => s + r.cents, 0);
    expect(sum).toBe(total);
    expect(total).toBe(13_000); // 3 x 43,33 € = 129,99 €? nein: 3 x 4333,33 Cent
  });

  it('gibt eine leere Liste fuer eine leere Periode', () => {
    const empty = makePeriod('month', at(2019, 1, 1));
    expect(categoryRanking(dataset, empty, 'variable')).toEqual([]);
  });

  it('verteilt Anteile, die sich auf 100 % summieren', () => {
    const rows = categoryRanking(dataset, september);
    const shareSum = rows.reduce((s, r) => s + r.share, 0);
    expect(shareSum).toBeCloseTo(100, 6);
  });
});

describe('deltaToPrevious', () => {
  it('vergleicht mit der Vorperiode', () => {
    const d: Dataset = {
      fixed: [],
      variable: [
        variable({ date: '2026-08-10', amountCents: 10_000 }),
        variable({ date: '2026-09-10', amountCents: 11_200 }),
      ],
    };
    expect(deltaToPrevious(d, september)?.percent).toBeCloseTo(12, 6);
  });

  it('liefert null, wenn die Vorperiode leer war', () => {
    const d: Dataset = { fixed: [], variable: [variable({ date: '2026-09-10', amountCents: 5000 })] };
    expect(deltaToPrevious(d, september)).toBeNull();
  });
});

describe('trendSeries', () => {
  it('endet bei der gewaehlten Periode und ist chronologisch', () => {
    const series = trendSeries(dataset, september);
    expect(series).toHaveLength(6);
    expect(series[5]?.period.startIso).toBe('2026-09-01');
    expect(series[0]?.period.startIso).toBe('2026-04-01');
  });
});

describe('groupByDay', () => {
  it('gruppiert nach Tag, neuester zuerst, mit Tagessumme', () => {
    const groups = groupByDay([
      variable({ date: '2026-09-11', amountCents: 1290 }),
      variable({ date: '2026-09-03', amountCents: 4832 }),
      variable({ date: '2026-09-11', amountCents: 750 }),
    ]);
    expect(groups.map((g) => g.date)).toEqual(['2026-09-11', '2026-09-03']);
    expect(groups[0]?.totalCents).toBe(2040);
    expect(groups[0]?.items).toHaveLength(2);
  });
});

describe('periodsWithData', () => {
  const heute = new Date(2026, 8, 17); // 17.09.2026

  it('nimmt nur Monate mit Ausgaben und lässt Lücken stehen', () => {
    const ds = {
      variable: [
        variable({ date: '2026-06-04', amountCents: 1000 }),
        variable({ date: '2026-08-11', amountCents: 2000 }),
      ],
      fixed: [],
    };
    const keys = periodsWithData(ds, 'month', { today: heute }).map((p) => p.startIso);
    // Juli fehlt bewusst - dort wurde nichts erfasst.
    expect(keys).toEqual(['2026-06-01', '2026-08-01', '2026-09-01']);
  });

  it('füllt jeden Monat, in dem eine Fixkostenposition läuft', () => {
    const ds = {
      variable: [],
      fixed: [fixed({ amountCents: 95_000, interval: 'monthly', startDate: '2026-07-01' })],
    };
    const keys = periodsWithData(ds, 'month', { today: heute }).map((p) => p.startIso);
    expect(keys).toEqual(['2026-07-01', '2026-08-01', '2026-09-01']);
  });

  it('hört auf, wo die Fixkostenposition beendet wurde', () => {
    const ds = {
      variable: [],
      fixed: [fixed({
        amountCents: 1000, interval: 'monthly',
        startDate: '2026-05-01', endDate: '2026-06-30',
      })],
    };
    const keys = periodsWithData(ds, 'month', { today: heute }).map((p) => p.startIso);
    // September ist trotzdem dabei: die laufende Periode ist immer wählbar.
    expect(keys).toEqual(['2026-05-01', '2026-06-01', '2026-09-01']);
  });

  it('enthält ohne jede Ausgabe genau die laufende Periode', () => {
    const keys = periodsWithData({ variable: [], fixed: [] }, 'month', { today: heute });
    expect(keys.map((p) => p.startIso)).toEqual(['2026-09-01']);
  });

  it('übergeht gelöschte Ausgaben und gelöschte Fixkosten', () => {
    const ds = {
      variable: [variable({ date: '2026-06-04', amountCents: 1000, deletedAt: '2026-06-05T00:00:00.000Z' })],
      fixed: [fixed({ amountCents: 1000, interval: 'monthly', startDate: '2026-01-01', deletedAt: '2026-02-01T00:00:00.000Z' })],
    };
    expect(periodsWithData(ds, 'month', { today: heute }).map((p) => p.startIso))
      .toEqual(['2026-09-01']);
  });

  it('behält die gewählte Periode, auch wenn sie leer ist', () => {
    const ds = { variable: [variable({ date: '2026-08-11', amountCents: 2000 })], fixed: [] };
    const leer = makePeriod('month', new Date(2026, 3, 1)); // April
    const keys = periodsWithData(ds, 'month', { today: heute, ensure: leer }).map((p) => p.startIso);
    expect(keys).toEqual(['2026-04-01', '2026-08-01', '2026-09-01']);
  });

  it('endet immer bei der laufenden Periode, nie in der Zukunft', () => {
    const ds = { variable: [variable({ date: '2027-03-01', amountCents: 500 })], fixed: [] };
    const keys = periodsWithData(ds, 'month', { today: heute }).map((p) => p.startIso);
    expect(keys.at(-1)).toBe('2026-09-01');
    expect(keys.some((k) => k > '2026-09-01')).toBe(false);
  });

  it('rechnet genauso für Wochen und Jahre', () => {
    const ds = { variable: [variable({ date: '2026-09-02', amountCents: 100 })], fixed: [] };
    // 2.9.2026 ist ein Mittwoch -> KW 36 beginnt am 31.08.
    expect(periodsWithData(ds, 'week', { today: heute }).map((p) => p.startIso))
      .toEqual(['2026-08-31', '2026-09-14']);
    expect(periodsWithData(ds, 'year', { today: heute }).map((p) => p.startIso))
      .toEqual(['2026-01-01']);
  });
});

describe('periodsWithData ohne Fixkosten', () => {
  const heute = new Date(2026, 8, 17);

  it('ignoriert laufende Fixkosten, wenn nur Erfasstes zählen soll', () => {
    const ds = {
      variable: [variable({ date: '2026-08-11', amountCents: 2000 })],
      fixed: [fixed({ amountCents: 95_000, interval: 'monthly', startDate: '2023-01-01' })],
    };
    expect(periodsWithData(ds, 'month', { today: heute }).length).toBeGreaterThan(40);
    expect(periodsWithData(ds, 'month', { today: heute, includeFixed: false })
      .map((p) => p.startIso)).toEqual(['2026-08-01', '2026-09-01']);
  });

  it('behält auch ohne Fixkosten die laufende Periode', () => {
    const ds = { variable: [], fixed: [fixed({ amountCents: 100, interval: 'monthly', startDate: '2023-01-01' })] };
    expect(periodsWithData(ds, 'month', { today: heute, includeFixed: false })
      .map((p) => p.startIso)).toEqual(['2026-09-01']);
  });
});
