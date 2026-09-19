import { describe, expect, it } from 'vitest';
import {
  containsIso, formatDayLabel, lastPeriods, makePeriod, periodLabel,
  periodStripLabel, shiftPeriod, toIsoDate,
} from './periods';

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe('Periodengrenzen', () => {
  it('beginnt die Woche am Montag', () => {
    // 17.09.2026 ist ein Donnerstag.
    const p = makePeriod('week', at(2026, 9, 17));
    expect(p.startIso).toBe('2026-09-14'); // Montag
    expect(p.endIso).toBe('2026-09-20');   // Sonntag
  });

  it('umfasst den ganzen Monat', () => {
    const p = makePeriod('month', at(2026, 9, 17));
    expect(p.startIso).toBe('2026-09-01');
    expect(p.endIso).toBe('2026-09-30');
  });

  it('kennt den Februar im Schaltjahr', () => {
    expect(makePeriod('month', at(2024, 2, 5)).endIso).toBe('2024-02-29');
    expect(makePeriod('month', at(2026, 2, 5)).endIso).toBe('2026-02-28');
  });

  it('umfasst das ganze Jahr', () => {
    const p = makePeriod('year', at(2026, 9, 17));
    expect(p.startIso).toBe('2026-01-01');
    expect(p.endIso).toBe('2026-12-31');
  });
});

describe('toIsoDate', () => {
  it('nimmt den lokalen Kalendertag, nicht den UTC-Tag', () => {
    // toISOString() wuerde hieraus je nach Zeitzone den Vortag machen.
    expect(toIsoDate(new Date(2026, 9, 1, 0, 30))).toBe('2026-10-01');
    expect(toIsoDate(new Date(2026, 0, 1, 23, 45))).toBe('2026-01-01');
  });
});

describe('Navigation', () => {
  it('springt ueber Jahresgrenzen', () => {
    const jan = makePeriod('month', at(2026, 1, 15));
    expect(shiftPeriod(jan, -1).startIso).toBe('2025-12-01');
    expect(shiftPeriod(jan, 12).startIso).toBe('2027-01-01');
  });

  it('trifft den 31. rueckwaerts nicht daneben', () => {
    // Vom 31. Maerz einen Monat zurueck darf nicht im 3. Maerz landen.
    const march = makePeriod('month', at(2026, 3, 31));
    expect(shiftPeriod(march, -1).startIso).toBe('2026-02-01');
    expect(shiftPeriod(march, -1).endIso).toBe('2026-02-28');
  });

  it('liefert die letzten N Perioden chronologisch', () => {
    const p = makePeriod('month', at(2026, 9, 1));
    const series = lastPeriods(p, 6);
    expect(series).toHaveLength(6);
    expect(series[0]?.startIso).toBe('2026-04-01');
    expect(series[5]?.startIso).toBe('2026-09-01');
  });
});

describe('containsIso', () => {
  it('schliesst beide Grenzen ein', () => {
    const p = makePeriod('month', at(2026, 9, 17));
    expect(containsIso(p, '2026-09-01')).toBe(true);
    expect(containsIso(p, '2026-09-30')).toBe(true);
    expect(containsIso(p, '2026-08-31')).toBe(false);
    expect(containsIso(p, '2026-10-01')).toBe(false);
  });
});

describe('Beschriftungen', () => {
  it('benennt Perioden auf Deutsch', () => {
    expect(periodLabel(makePeriod('month', at(2026, 9, 1)))).toBe('September 2026');
    expect(periodLabel(makePeriod('year', at(2026, 9, 1)))).toBe('2026');
    expect(periodLabel(makePeriod('week', at(2026, 9, 17)))).toContain('KW 38');
  });

  it('sagt Heute und Gestern statt eines Datums', () => {
    expect(formatDayLabel('2026-09-17', '2026-09-17')).toBe('Heute');
    expect(formatDayLabel('2026-09-16', '2026-09-17')).toBe('Gestern');
    expect(formatDayLabel('2026-09-15', '2026-09-17')).toContain('15. Sep');
  });

  it('kommt beim Monatswechsel mit Gestern klar', () => {
    expect(formatDayLabel('2026-08-31', '2026-09-01')).toBe('Gestern');
  });
});

describe('Auswahlstreifen', () => {



  it('beschriftet Monate mit Kurzname und Jahr', () => {
    expect(periodStripLabel(makePeriod('month', at(2026, 9, 17))))
      // date-fns kuerzt deutsche Monatsnamen mit Punkt ab - dieselbe
      // Schreibweise wie auf der Achse des Verlaufs-Charts.
      .toEqual({ primary: 'Sep.', secondary: '2026' });
  });

  it('beschriftet Wochen mit KW und Datumsspanne', () => {
    // KW 38 laeuft vom 14. bis 20. September.
    expect(periodStripLabel(makePeriod('week', at(2026, 9, 17))))
      .toEqual({ primary: 'KW 38', secondary: '14.–20.9.' });
  });

  it('spannt die Wochenbeschriftung ueber den Monatswechsel', () => {
    // 30.09.2026 ist ein Mittwoch: die Woche laeuft vom 28.9. bis 4.10.
    expect(periodStripLabel(makePeriod('week', at(2026, 9, 30))).secondary)
      .toBe('28.–4.10.');
  });

  it('laesst die Unterzeile beim Jahr leer', () => {
    expect(periodStripLabel(makePeriod('year', at(2026, 9, 17))))
      .toEqual({ primary: '2026', secondary: '' });
  });
});
