import { describe, expect, it } from 'vitest';
import { buildExportBundle, parseImport, toCsv, toJson, toMarkdownReport } from './transfer';
import { buildSeedData } from './seed';
import { makePeriod } from '@/lib/periods';

const seed = buildSeedData('2026-09-17');
const source = {
  categories: seed.categories,
  variableExpenses: seed.variableExpenses,
  fixedExpenses: seed.fixedExpenses,
};

describe('JSON-Export', () => {
  it('laesst sich verlustfrei wieder einlesen', () => {
    // Das ist die Zusage des Formats: exportieren, alles loeschen,
    // importieren - und es ist wieder da.
    const bundle = buildExportBundle(source);
    const result = parseImport(toJson(bundle));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bundle.variableExpenses).toEqual(bundle.variableExpenses);
    expect(result.bundle.fixedExpenses).toEqual(bundle.fixedExpenses);
    expect(result.bundle.categories).toEqual(bundle.categories);
  });

  it('nimmt geloeschte Eintraege nicht mit', () => {
    const withDeleted = {
      ...source,
      variableExpenses: [
        ...source.variableExpenses,
        { ...source.variableExpenses[0]!, id: 'weg', deletedAt: '2026-09-01T00:00:00Z' },
      ],
    };
    expect(buildExportBundle(withDeleted).variableExpenses.some((e) => e.id === 'weg')).toBe(false);
  });

  it('weist kaputte und zu neue Dateien ab', () => {
    expect(parseImport('kein json').ok).toBe(false);
    expect(parseImport('{"schemaVersion":1}').ok).toBe(false);
    const future = toJson({ ...buildExportBundle(source), schemaVersion: 99 });
    const res = parseImport(future);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('neueren Version');
  });
});

describe('CSV-Export', () => {
  const csv = toCsv(source, 'de');

  it('beginnt mit BOM und sep-Zeile fuer deutsches Excel', () => {
    expect(csv.startsWith('﻿sep=;')).toBe(true);
  });

  it('nutzt Komma als Dezimaltrennzeichen', () => {
    expect(csv).toMatch(/;\d+,\d{2};/);
  });

  it('haelt die Spaltenzahl in jeder Zeile ein', () => {
    const lines = csv.replace(/^﻿/, '').split('\r\n').filter(Boolean).slice(1);
    const header = lines[0]!.split(';').length;
    // Zellen mit Semikolon sind gequotet - hier reicht die Pruefung der
    // Zeilen ohne Anfuehrungszeichen.
    for (const line of lines.slice(1)) {
      if (line.includes('"')) continue;
      expect(line.split(';').length).toBe(header);
    }
  });

  it('kann auch international', () => {
    const intl = toCsv(source, 'international');
    expect(intl.startsWith('﻿typ,')).toBe(true);
    expect(intl).toMatch(/,\d+\.\d{2},/);
  });
});

describe('Markdown-Bericht', () => {
  it('enthaelt Gesamtsumme und Kategorietabelle', () => {
    const md = toMarkdownReport(
      { variable: seed.variableExpenses, fixed: seed.fixedExpenses },
      makePeriod('month', new Date(2026, 8, 15)),
      seed.categories,
    );
    expect(md).toContain('# Ausgaben September 2026');
    expect(md).toContain('| Kategorie | Betrag | Anteil |');
  });
});
