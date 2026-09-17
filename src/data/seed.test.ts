import { describe, expect, it } from 'vitest';
import { buildSeedData } from './seed';
import { RECURRENCE_INTERVALS } from './schema';
import { DEFAULT_CATEGORIES } from './defaultCategories';
import { categoryRanking, periodTotals, type Dataset } from '@/lib/aggregations';
import { makePeriod } from '@/lib/periods';

const END = '2026-09-17';
const data = buildSeedData(END);
const dataset: Dataset = { variable: data.variableExpenses, fixed: data.fixedExpenses };
const september = makePeriod('month', new Date(2026, 8, 15));

describe('Demo-Daten', () => {
  it('sind deterministisch', () => {
    // Gleicher Seed, gleiche Daten - sonst sieht die App bei jedem Setup
    // anders aus und nichts laesst sich vergleichen.
    const again = buildSeedData(END);
    expect(again.variableExpenses).toEqual(data.variableExpenses);
  });

  it('decken alle sechs Wiederholungsintervalle ab', () => {
    const used = new Set(data.fixedExpenses.map((f) => f.interval));
    for (const interval of RECURRENCE_INTERVALS) expect(used).toContain(interval);
  });

  it('verweisen nur auf existierende Kategorien', () => {
    const ids = new Set(DEFAULT_CATEGORIES.map((c) => c.id));
    for (const e of data.variableExpenses) expect(ids).toContain(e.categoryId);
    for (const f of data.fixedExpenses) expect(ids).toContain(f.categoryId);
  });

  it('fuellen mehrere Monate mit genug Eintraegen fuer ein Trend-Chart', () => {
    expect(data.variableExpenses.length).toBeGreaterThan(200);
    const months = new Set(data.variableExpenses.map((e) => e.date.slice(0, 7)));
    expect(months.size).toBeGreaterThanOrEqual(6);
  });

  it('sind ungleich verteilt - sonst saehe jedes Chart gleich aus', () => {
    const rows = categoryRanking(dataset, september);
    const top = rows[0];
    const last = rows[rows.length - 1];
    expect(top).toBeDefined();
    expect(last).toBeDefined();
    // Die groesste Kategorie muss die kleinste deutlich ueberragen.
    expect((top?.cents ?? 0) / Math.max(1, last?.cents ?? 1)).toBeGreaterThan(5);
  });

  it('ergeben einen plausiblen Monat', () => {
    const t = periodTotals(dataset, september);
    expect(t.fixedCents).toBeGreaterThan(100_000);
    expect(t.variableCents).toBeGreaterThan(30_000);
    expect(t.totalCents).toBe(t.fixedCents + t.variableCents);
  });

  it('enthalten keine Ausgaben in der Zukunft', () => {
    for (const e of data.variableExpenses) expect(e.date <= END).toBe(true);
  });
});
