import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { DEFAULT_CATEGORIES } from '@/data/defaultCategories';
import { categoryColorVars } from '@/lib/categoryColor';
import { measureContrast } from '@/lib/contrast';
import { useTheme, type ThemeMode } from '@/store/theme';
import s from './TokenPreview.module.css';

const FONT_STEPS = [
  { step: 1, px: 10, use: 'Overlines, Chart-Achsen' },
  { step: 2, px: 12, use: 'Zeitstempel, Tab-Label' },
  { step: 3, px: 14, use: 'Notizen, Chips' },
  { step: 4, px: 16, use: 'Basis: Text, Listen, Inputs' },
  { step: 5, px: 20, use: 'Screen- und Section-Titel' },
  { step: 6, px: 24, use: 'Perioden-Summe' },
  { step: 7, px: 32, use: 'Betrag-Eingabe' },
  { step: 8, px: 48, use: 'Dashboard-Hero' },
] as const;

const SPACE_STEPS = [
  { step: 1, px: 2 }, { step: 2, px: 4 }, { step: 3, px: 8 },
  { step: 4, px: 12 }, { step: 5, px: 16 }, { step: 6, px: 20 },
  { step: 7, px: 24 }, { step: 8, px: 32 }, { step: 9, px: 40 },
  { step: 10, px: 48 }, { step: 11, px: 64 }, { step: 12, px: 80 },
] as const;

const RADII = [
  { token: '1', px: '4', use: 'Badges' },
  { token: '2', px: '8', use: 'Inputs' },
  { token: '3', px: '12', use: 'Buttons' },
  { token: '4', px: '16', use: 'Cards' },
  { token: '5', px: '24', use: 'Sheet' },
  { token: 'full', px: '∞', use: 'Pills' },
] as const;

const THEME_OPTIONS: readonly { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
];

const fmt = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

/** Misst den Kontrast jeder Kategoriefarbe gegen die App-Flaeche neu,
 *  sobald das Theme wechselt. */
function useCategoryContrast(resolvedTheme: string) {
  const [ratios, setRatios] = useState<Record<string, number>>({});
  useEffect(() => {
    const next: Record<string, number> = {};
    for (const cat of DEFAULT_CATEGORIES) {
      const r = measureContrast(`var(--${cat.color}-11)`, 'var(--bg-canvas)');
      if (r !== null) next[cat.id] = r;
    }
    setRatios(next);
  }, [resolvedTheme]);
  return ratios;
}

export function TokenPreview() {
  const mode = useTheme((st) => st.mode);
  const resolved = useTheme((st) => st.resolved);
  const setMode = useTheme((st) => st.setMode);
  const ratios = useCategoryContrast(resolved);

  const worst = Object.values(ratios).length
    ? Math.min(...Object.values(ratios))
    : null;

  return (
    <div className={s.page}>
      <Link
        to="/mehr"
        className={s.subtitle}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', minHeight: 'var(--tap-target-min)', textDecoration: 'none' }}
      >
        <ChevronLeft size={18} aria-hidden /> Mehr
      </Link>
      <header className={s.header}>
        <div>
          <h1 className={s.title}>Design-Tokens</h1>
          <p className={s.subtitle}>
            Money&gt;Month · Akzent gold, Neutral sand · aktuell {resolved === 'dark' ? 'dunkel' : 'hell'}
          </p>
        </div>
        <div className={s.themeSwitch} role="group" aria-label="Erscheinungsbild">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`${s.themeOption} ${mode === opt.value ? s.themeOptionActive : ''}`}
              aria-pressed={mode === opt.value}
              onClick={() => setMode(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </header>

      {/* ---------------------------------------------------------------- */}
      <section className={s.section}>
        <h2 className={s.sectionTitle}>Schrift · Basis 16 · Hero 48</h2>
        <p className={s.note}>
          Ab der Basis liegt die Skala auf dem 4er-Raster: 16 → 20 → 24 → 32 → 48.
          Eingabefelder nie unter 16 px, sonst zoomt iOS Safari beim Fokus hinein.
        </p>
        <div className={s.card}>
          {FONT_STEPS.map((f) => (
            <div key={f.step} className={s.row}>
              <span className={s.rowMeta}>{f.step} · {f.px} px</span>
              <span
                className={s.sample}
                style={{
                  fontSize: `var(--font-size-${f.step})`,
                  lineHeight: `var(--line-height-${f.step})`,
                  letterSpacing: `var(--letter-spacing-${f.step})`,
                  fontWeight: f.px >= 20 ? 'var(--font-weight-semibold)' : undefined,
                  textTransform: f.step === 1 ? 'uppercase' : undefined,
                }}
              >
                {f.step >= 6 ? '1.099,30 €' : 'Lebensmittel'}
              </span>
              <span className={s.rowUse}>{f.use}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className={s.section}>
        <h2 className={s.sectionTitle}>Abstände · 4-px-Raster · Standard 12</h2>
        <div className={s.card}>
          {SPACE_STEPS.map((sp) => (
            <div key={sp.step} className={s.spaceRow}>
              <span className={s.rowMeta}>{sp.step} · {sp.px} px</span>
              <span className={s.spaceBar} style={{ width: `var(--space-${sp.step})` }} />
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className={s.section}>
        <h2 className={s.sectionTitle}>Radien · nur Vielfache von 4</h2>
        <p className={s.note}>
          Verschachtelung: innen = außen − Padding. Die Card unten hat Radius 16
          bei 12 px Padding, ihre inneren Felder deshalb Radius 4.
        </p>
        <div className={s.radiiGrid}>
          {RADII.map((r) => (
            <div
              key={r.token}
              className={s.radiusBox}
              style={{ borderRadius: `var(--radius-${r.token})` }}
            >
              <strong>{r.px}</strong>
              <span>{r.use}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className={s.section}>
        <h2 className={s.sectionTitle}>Kategoriefarben · Radix Stufe 11</h2>
        <p className={s.note}>
          Kontrast gegen die App-Fläche, im laufenden Theme gemessen.
          Schlechtester Wert gerade: <strong>{worst ? `${worst.toFixed(2)}:1` : '…'}</strong>
          {' '}(WCAG AA verlangt 4,5:1 für Text, 3:1 für UI-Elemente).
          Mit der üblichen Stufe 9 lägen hier fünf Kategorien im hellen Modus
          unter 3:1 — yellow bei 1,24:1.
        </p>
        <div className={s.swatchGrid}>
          {DEFAULT_CATEGORIES.map((cat) => {
            const ratio = ratios[cat.id];
            return (
              <div key={cat.id} className={s.swatch} style={categoryColorVars(cat.color)}>
                <span className={s.dot} />
                <span className={s.swatchLabel}>{cat.name.split(' &')[0]}</span>
                <span className={s.swatchRatio}>
                  {ratio === undefined ? '–' : `${ratio.toFixed(1)}:1`}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className={s.section}>
        <h2 className={s.sectionTitle}>Semantik</h2>
        <div className={s.semanticGrid}>
          <div className={s.semanticChip} style={{ background: 'var(--cta-bg)', color: 'var(--cta-text)' }}>
            Hauptaktion
          </div>
          <div className={s.semanticChip} style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)' }}>
            Destruktiv
          </div>
          <div className={s.semanticChip} style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)' }}>
            Warnung
          </div>
          <div className={s.semanticChip} style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}>
            Sekundärtext
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className={s.section}>
        <h2 className={s.sectionTitle}>Bedienelemente · 28 / 36 / 44</h2>
        <div className={s.controlRow}>
          <button type="button" className="btn btn--primary btn--sm">Klein</button>
          <button type="button" className="btn btn--primary btn--md">Mittel</button>
          <button type="button" className="btn btn--primary">Speichern</button>
          <button type="button" className="btn btn--secondary">Abbrechen</button>
        </div>
        <div className={s.controlRow} style={{ marginTop: 'var(--space-4)' }}>
          <input className="input" type="text" inputMode="decimal" placeholder="0,00 €" aria-label="Betrag" />
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className={s.section}>
        <h2 className={s.sectionTitle}>Im Zusammenspiel</h2>
        <div className={s.hero} style={{ marginBottom: 'var(--space-5)' }}>
          <p className={s.heroLabel}>September 2026</p>
          <p className={s.heroAmount}>{fmt.format(1099.3)}</p>
          <p className={s.heroDelta}>+12 % ggü. August</p>
        </div>
        <div className={s.card} style={{ padding: 0 }}>
          {DEFAULT_CATEGORIES.slice(0, 4).map((cat, i) => (
            <div key={cat.id} className={s.listRow} style={categoryColorVars(cat.color)}>
              <span className={s.dot} />
              <span className={s.listMain}>
                <span className={s.listName} style={{ display: 'block' }}>{cat.name}</span>
                <span className={s.listNote}>
                  {['Rewe, Wocheneinkauf', 'Mittagessen im Büro', 'Feierabendbier', 'Monatskarte'][i]}
                </span>
              </span>
              <span className={s.listAmount}>{fmt.format([48.32, 12.9, 7.5, 58][i] ?? 0)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
