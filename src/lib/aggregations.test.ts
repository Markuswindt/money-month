import { describe, expect, it } from 'vitest';
import {
  categoryRanking, deltaToPrevious, distributeRounding, groupByDay,
  periodTotals, trendSeries, type Dataset,
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
