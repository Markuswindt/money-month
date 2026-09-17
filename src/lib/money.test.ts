import { describe, expect, it } from 'vitest';
import { formatDecimal, formatMoney, parseAmount, percentOf } from './money';

describe('parseAmount', () => {
  it('liest deutsche und englische Schreibweise als denselben Betrag', () => {
    expect(parseAmount('12,50')).toBe(1250);
    expect(parseAmount('12.50')).toBe(1250);
    expect(parseAmount('12')).toBe(1200);
  });

  it('erkennt den Punkt als Tausendertrennzeichen', () => {
    expect(parseAmount('1.500')).toBe(150_000);
    expect(parseAmount('1.234,56')).toBe(123_456);
    expect(parseAmount('1,234.56')).toBe(123_456);
  });

  it('behandelt 0.750 als Dezimalzahl, nicht als Tausender', () => {
    // "0.750" kann keine Tausendergruppierung sein - davor steht nur eine Null.
    expect(parseAmount('0.750')).toBe(75);
  });

  it('ignoriert Waehrungszeichen und Leerraum', () => {
    expect(parseAmount(' 12,50 € ')).toBe(1250);
    expect(parseAmount('€12,50')).toBe(1250);
    expect(parseAmount('1 234,56')).toBe(123_456);
  });

  it('rundet auf ganze Cent', () => {
    expect(parseAmount('0,005')).toBe(1);
    expect(parseAmount('12,999')).toBe(1300);
  });

  it('liefert null fuer Unsinn', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('1,2,3')).toBeNull();
    expect(parseAmount('99999999999')).toBeNull();
  });
});

describe('Formatierung', () => {
  it('formatiert nach de-DE', () => {
    // Intl nutzt ein schmales geschuetztes Leerzeichen vor dem Euro.
    expect(formatMoney(109_930).replace(/ | /g, ' ')).toBe('1.099,30 €');
    expect(formatDecimal(109_930)).toBe('1.099,30');
  });
});

describe('percentOf', () => {
  it('ist 0 statt NaN, wenn die Gesamtsumme 0 ist', () => {
    expect(percentOf(0, 0)).toBe(0);
    expect(percentOf(2500, 10_000)).toBe(25);
  });
});
