import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Download, FileText, Table2, Upload } from 'lucide-react';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { toast } from '@/components/ui/toast';
import { useTheme, type ThemeMode } from '@/store/theme';
import { useDataStore } from '@/store/dataStore';
import { useUiStore } from '@/store/uiStore';
import { useDataset } from '@/store/selectors';
import { isStoragePersisted, requestPersistentStorage } from '@/data/localRepo';
import {
  buildExportBundle, parseImport, saveFile, timestampedName,
  toCsv, toJson, toMarkdownReport,
} from '@/data/transfer';
import s from './Settings.module.css';

const THEME_OPTIONS: readonly { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
];

export function SettingsScreen() {
  const mode = useTheme((st) => st.mode);
  const setMode = useTheme((st) => st.setMode);
  const categories = useDataStore((st) => st.categories);
  const variableExpenses = useDataStore((st) => st.variableExpenses);
  const fixedExpenses = useDataStore((st) => st.fixedExpenses);
  const settings = useDataStore((st) => st.settings);
  const dataset = useDataset();
  const period = useUiStore((st) => st.period);

  const [persisted, setPersisted] = useState<boolean | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void isStoragePersisted().then(setPersisted);
  }, []);

  const liveVariable = variableExpenses.filter((e) => e.deletedAt === null).length;
  const liveFixed = fixedExpenses.filter((f) => f.deletedAt === null).length;

  async function exportJson() {
    const bundle = buildExportBundle({ categories, variableExpenses, fixedExpenses, settings });
    const how = await saveFile(timestampedName('money-month-backup', 'json'), 'application/json', toJson(bundle));
    toast(how === 'shared' ? 'Backup geteilt' : 'Backup gespeichert');
  }

  async function exportCsv() {
    const how = await saveFile(
      timestampedName('money-month', 'csv'),
      'text/csv',
      toCsv({ categories, variableExpenses, fixedExpenses }, 'de'),
    );
    toast(how === 'shared' ? 'CSV geteilt' : 'CSV gespeichert');
  }

  async function exportMarkdown() {
    const how = await saveFile(
      timestampedName('money-month-bericht', 'md'),
      'text/markdown',
      toMarkdownReport(dataset, period, categories),
    );
    toast(how === 'shared' ? 'Bericht geteilt' : 'Bericht gespeichert');
  }

  async function handleImportFile(file: File) {
    const result = parseImport(await file.text());
    if (!result.ok) {
      toast('Import fehlgeschlagen', { description: result.error, timeout: 8000 });
      return;
    }
    // Zusammenfuehren statt ersetzen: ein Import soll nie stillschweigend
    // Daten vernichten, die nur auf diesem Geraet stehen.
    const { added, updated } = await useDataStore.getState().mergeImport({
      categories: result.bundle.categories,
      variableExpenses: result.bundle.variableExpenses,
      fixedExpenses: result.bundle.fixedExpenses,
    });
    toast(`${added} neu, ${updated} aktualisiert`, { timeout: 6000 });
  }

  async function enablePersistence() {
    const ok = await requestPersistentStorage();
    setPersisted(ok);
    toast(ok ? 'Daten sind jetzt dauerhaft gespeichert' : 'Der Browser hat abgelehnt');
  }

  async function reloadDemo() {
    await useDataStore.getState().loadDemoData();
    toast('Demo-Daten neu geladen');
  }

  async function clearAll() {
    await useDataStore.getState().clearAll();
    toast('Alle Ausgaben gelöscht');
  }

  return (
    <div className={s.page}>
      <h1 className={s.title}>Mehr</h1>

      <section className={s.section}>
        <h2 className="sectionTitle">Erscheinungsbild</h2>
        <SegmentedControl<ThemeMode>
          value={mode}
          options={THEME_OPTIONS}
          onChange={setMode}
          ariaLabel="Erscheinungsbild"
        />
      </section>

      <section className={s.section}>
        <h2 className="sectionTitle">Kategorien</h2>
        <div className="card card--flush">
          <Link to="/mehr/kategorien" className={s.row}>
            <span className={s.rowBody}>
              <span className={s.rowTitle}>Kategorien verwalten</span>
              <span className={s.rowHint}>
                {categories.filter((c) => c.archivedAt === null).length} aktiv
              </span>
            </span>
            <ChevronRight size={18} className={s.rowAside} aria-hidden />
          </Link>
        </div>
      </section>

      <section className={s.section}>
        <h2 className="sectionTitle">Daten sichern</h2>
        <div className="card card--flush">
          <button type="button" className={s.row} onClick={() => void exportJson()}>
            <Download size={18} aria-hidden />
            <span className={s.rowBody}>
              <span className={s.rowTitle}>Backup als JSON</span>
              <span className={s.rowHint}>Vollständig und wieder einlesbar</span>
            </span>
          </button>
          <button type="button" className={s.row} onClick={() => void exportCsv()}>
            <Table2 size={18} aria-hidden />
            <span className={s.rowBody}>
              <span className={s.rowTitle}>CSV für Excel oder Numbers</span>
              <span className={s.rowHint}>Semikolon und Komma, deutsches Format</span>
            </span>
          </button>
          <button type="button" className={s.row} onClick={() => void exportMarkdown()}>
            <FileText size={18} aria-hidden />
            <span className={s.rowBody}>
              <span className={s.rowTitle}>Bericht als Markdown</span>
              <span className={s.rowHint}>Zusammenfassung des aktuellen Zeitraums</span>
            </span>
          </button>
          <button type="button" className={s.row} onClick={() => fileInput.current?.click()}>
            <Upload size={18} aria-hidden />
            <span className={s.rowBody}>
              <span className={s.rowTitle}>Backup einlesen</span>
              <span className={s.rowHint}>Wird zusammengeführt, nichts wird überschrieben</span>
            </span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className={s.hiddenInput}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportFile(file);
              e.target.value = '';
            }}
          />
        </div>

        <p className={s.note}>
          {liveVariable} Ausgaben und {liveFixed} Fixkosten auf diesem Gerät.
        </p>

        {persisted === false && (
          <div className={s.warning}>
            <p>
              Der Browser darf diese Daten bei Platzmangel löschen. Safari räumt
              Speicher nach sieben Tagen ohne Nutzung ab — auf dem Home-Bildschirm
              installierte Apps sind davon ausgenommen.
            </p>
            <button
              type="button"
              className="btn btn--secondary btn--md"
              style={{ marginTop: 'var(--space-3)' }}
              onClick={() => void enablePersistence()}
            >
              Dauerhaft speichern
            </button>
          </div>
        )}
        {persisted === true && (
          <p className={s.note}>Daten sind als dauerhaft markiert. Ein Backup bleibt trotzdem die sicherste Absicherung.</p>
        )}
      </section>

      <section className={s.section}>
        <h2 className="sectionTitle">Demo-Daten</h2>
        <div className="card card--flush">
          <button type="button" className={s.row} onClick={() => void reloadDemo()}>
            <span className={s.rowBody}>
              <span className={s.rowTitle}>Demo-Daten neu laden</span>
              <span className={s.rowHint}>Ersetzt alles durch den Beispielbestand</span>
            </span>
          </button>
          <button type="button" className={s.row} onClick={() => void clearAll()}>
            <span className={s.rowBody}>
              <span className={s.rowTitle}>Alle Ausgaben löschen</span>
              <span className={s.rowHint}>Kategorien bleiben erhalten</span>
            </span>
          </button>
        </div>
        {settings.demoDataLoaded && (
          <p className={s.note}>Aktuell sind Demo-Daten geladen.</p>
        )}
      </section>

      <section className={s.section}>
        <h2 className="sectionTitle">Über</h2>
        <div className="card card--flush">
          <Link to="/mehr/tokens" className={s.row}>
            <span className={s.rowBody}>
              <span className={s.rowTitle}>Design-Tokens</span>
              <span className={s.rowHint}>Schrift, Abstände, Radien und Farben</span>
            </span>
            <ChevronRight size={18} className={s.rowAside} aria-hidden />
          </Link>
          <div className={s.row}>
            <span className={s.rowBody}>
              <span className={s.rowTitle}>Money&gt;Month</span>
              <span className={s.rowHint}>Alle Daten bleiben auf diesem Gerät.</span>
            </span>
            <span className={s.rowAside}>0.1.0</span>
          </div>
        </div>
      </section>
    </div>
  );
}
