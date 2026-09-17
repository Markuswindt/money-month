import { describe, expect, it } from 'vitest';
import { makePeriod } from './periods';
import {
  amountInPeriod, coverage, dueDatesBetween, fullPeriodCents,
  isActiveInPeriod, monthlyCents, nextDueDate,
} from './recurrence';
import { fixed } from './testFixtures';

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe('Amortisierung', () => {
  it('rechnet 240 €/Jahr auf 20,00 €/Monat und 4,62 €/Woche um', () => {
    const f = fixed({ amountCents: 24_000, interval: 'yearly' });
    expect(monthlyCents(f)).toBe(2000);
    expect(Math.round(fullPeriodCents(f, 'week'))).toBe(462);
    expect(Math.round(fullPeriodCents(f, 'year'))).toBe(24_000);
  });

  it('rechnet 10 €/Woche auf 43,33 €/Monat und 520 €/Jahr um', () => {
    const f = fixed({ amountCents: 1000, interval: 'weekly' });
    expect(Math.round(monthlyCents(f))).toBe(4333);
    expect(Math.round(fullPeriodCents(f, 'year'))).toBe(52_000);
  });

  it('ist rundreise-stabil', () => {
    // Monat -> Jahr -> Woche -> Monat muss wieder beim Ausgangswert landen.
    const f = fixed({ amountCents: 100_000, interval: 'monthly' });
    expect(fullPeriodCents(f, 'month')).toBe(100_000);
    expect(fullPeriodCents(f, 'year')).toBe(1_200_000);
    expect(Math.round(fullPeriodCents(f, 'week'))).toBe(23_077);
  });

  it('laesst quartalsweise und halbjaehrlich im Monat aufgehen', () => {
    expect(monthlyCents(fixed({ amountCents: 6000, interval: 'quarterly' }))).toBe(2000);
    expect(monthlyCents(fixed({ amountCents: 12_000, interval: 'semiannual' }))).toBe(2000);
    expect(monthlyCents(fixed({ amountCents: 4000, interval: 'biweekly' }))).toBeCloseTo(8666.67, 1);
  });
});

describe('Laufzeit', () => {
  const september = makePeriod('month', at(2026, 9, 15));

  it('zaehlt eine laufende Position voll', () => {
    const f = fixed({ amountCents: 100_000, interval: 'monthly' });
    expect(isActiveInPeriod(f, september)).toBe(true);
    expect(coverage(f, september)).toBe(1);
    expect(amountInPeriod(f, september)).toBe(100_000);
  });

  it('ignoriert eine Position, die erst spaeter beginnt', () => {
    const f = fixed({ amountCents: 100_000, interval: 'monthly', startDate: '2026-10-01' });
    expect(isActiveInPeriod(f, september)).toBe(false);
    expect(amountInPeriod(f, september)).toBe(0);
  });

  it('ignoriert eine beendete Position', () => {
    const f = fixed({ amountCents: 100_000, interval: 'monthly', endDate: '2026-08-31' });
    expect(amountInPeriod(f, september)).toBe(0);
  });

  it('bricht eine Jahresansicht auf den tatsaechlichen Zeitraum herunter', () => {
    // Miete seit 1. Juli: die Jahresansicht darf nicht 12 Monatsmieten zeigen.
    const f = fixed({ amountCents: 100_000, interval: 'monthly', startDate: '2026-07-01' });
    const year = makePeriod('year', at(2026, 6, 1));
    const months = amountInPeriod(f, year) / 100_000;
    expect(months).toBeGreaterThan(5.9);
    expect(months).toBeLessThan(6.2);
  });

  it('teilt einen angebrochenen Monat anteilig', () => {
    const f = fixed({ amountCents: 300_000, interval: 'monthly', startDate: '2026-09-16' });
    // 16.-30. September sind 15 von 30 Tagen.
    expect(coverage(f, september)).toBeCloseTo(0.5, 5);
    expect(amountInPeriod(f, september)).toBeCloseTo(150_000, 0);
  });
});

describe('nextDueDate', () => {
  it('findet den naechsten Monatstermin', () => {
    const f = fixed({ amountCents: 1000, interval: 'monthly', dueDay: 15, startDate: '2026-01-15' });
    expect(nextDueDate(f, '2026-09-01')).toBe('2026-09-15');
    expect(nextDueDate(f, '2026-09-15')).toBe('2026-09-15');
    expect(nextDueDate(f, '2026-09-16')).toBe('2026-10-15');
  });

  it('schiebt den 31. nicht in den Folgemonat', () => {
    // November hat 30 Tage - die Abbuchung gehoert auf den 30., nicht auf den 1.12.
    const f = fixed({ amountCents: 1000, interval: 'monthly', dueDay: 31, startDate: '2026-01-31' });
    expect(nextDueDate(f, '2026-11-01')).toBe('2026-11-30');
    expect(nextDueDate(f, '2026-02-01')).toBe('2026-02-28');
  });

  it('trifft den 29. Februar im Schaltjahr', () => {
    const f = fixed({ amountCents: 1000, interval: 'monthly', dueDay: 31, startDate: '2023-01-31' });
    expect(nextDueDate(f, '2024-02-01')).toBe('2024-02-29');
  });

  it('rechnet quartalsweise in Dreierschritten', () => {
    const f = fixed({ amountCents: 1000, interval: 'quarterly', dueDay: 1, startDate: '2026-01-01' });
    expect(nextDueDate(f, '2026-02-01')).toBe('2026-04-01');
    expect(nextDueDate(f, '2026-05-01')).toBe('2026-07-01');
  });

  it('trifft bei woechentlich den richtigen Wochentag', () => {
    // dueDay 3 = Mittwoch. Start ist ein Montag (2026-09-14).
    const f = fixed({ amountCents: 1000, interval: 'weekly', dueDay: 3, startDate: '2026-09-14' });
    expect(nextDueDate(f, '2026-09-14')).toBe('2026-09-16');
    expect(nextDueDate(f, '2026-09-17')).toBe('2026-09-23');
  });

  it('haelt bei 2-woechentlich den 14-Tage-Takt', () => {
    const f = fixed({ amountCents: 1000, interval: 'biweekly', dueDay: 1, startDate: '2026-09-07' });
    expect(nextDueDate(f, '2026-09-07')).toBe('2026-09-07');
    expect(nextDueDate(f, '2026-09-08')).toBe('2026-09-21');
  });

  it('liefert null nach dem Enddatum', () => {
    const f = fixed({
      amountCents: 1000, interval: 'monthly', dueDay: 1,
      startDate: '2026-01-01', endDate: '2026-06-30',
    });
    expect(nextDueDate(f, '2026-07-01')).toBeNull();
  });
});

describe('dueDatesBetween', () => {
  it('listet alle Termine im Fenster', () => {
    const f = fixed({ amountCents: 1000, interval: 'monthly', dueDay: 1, startDate: '2026-01-01' });
    expect(dueDatesBetween(f, '2026-09-01', '2026-11-30')).toEqual([
      '2026-09-01', '2026-10-01', '2026-11-01',
    ]);
  });

  it('gibt eine leere Liste, wenn nichts faellig ist', () => {
    const f = fixed({ amountCents: 1000, interval: 'yearly', dueDay: 1, startDate: '2026-01-01' });
    expect(dueDatesBetween(f, '2026-02-01', '2026-11-30')).toEqual([]);
  });
});
