import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '@base-ui/react/drawer';
import { NumberField } from '@base-ui/react/number-field';
import { Trash2, X } from 'lucide-react';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { DatePicker } from '@/components/ui/DatePicker';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select, type SelectOption } from '@/components/ui/Select';
import { categoryColorVars } from '@/lib/categoryColor';
import { formatMoney } from '@/lib/money';
import { formatFullDate, fromIsoDate, toIsoDate, todayIso } from '@/lib/periods';
import { monthlyCents, nextDueDate } from '@/lib/recurrence';
import {
  INTERVAL_LABELS, RECURRENCE_INTERVALS, type FixedExpense, type RecurrenceInterval,
} from '@/data/schema';
import { useDataStore } from '@/store/dataStore';
import { useEntryStore, type EntryMode } from '@/store/entryStore';
import { useRecentCategoryIds, useSelectableCategories } from '@/store/selectors';
import { toast } from '@/components/ui/toast';
import s from './EntrySheet.module.css';

const MODE_OPTIONS = [
  { value: 'variable' as const, label: 'Variabel' },
  { value: 'fixed' as const, label: 'Fix' },
];

const INTERVAL_OPTIONS: readonly SelectOption<RecurrenceInterval>[] =
  RECURRENCE_INTERVALS.map((i) => ({ value: i, label: INTERVAL_LABELS[i] }));

/* Ausgeschriebene Wochentage statt "Mo"/"Di": in einer ausklappbaren Liste
   ist genug Platz, und die Kurzform war nur dem engen nativen Feld
   geschuldet. */
const WEEKDAY_OPTIONS: readonly SelectOption<number>[] = [
  { value: 1, label: 'Montag' }, { value: 2, label: 'Dienstag' },
  { value: 3, label: 'Mittwoch' }, { value: 4, label: 'Donnerstag' },
  { value: 5, label: 'Freitag' }, { value: 6, label: 'Samstag' },
  { value: 7, label: 'Sonntag' },
];

const DAY_OF_MONTH_OPTIONS: readonly SelectOption<number>[] =
  Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: `${i + 1}.` }));

function startOfCurrentMonthIso(): string {
  const now = new Date();
  return toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

function yesterdayIso(): string {
  return toIsoDate(new Date(fromIsoDate(todayIso()).getTime() - 86_400_000));
}

export function EntrySheet() {
  const open = useEntryStore((st) => st.open);
  const close = useEntryStore((st) => st.close);
  const storeMode = useEntryStore((st) => st.mode);
  const editingVariable = useEntryStore((st) => st.editingVariable);
  const editingFixed = useEntryStore((st) => st.editingFixed);
  const presetCategoryId = useEntryStore((st) => st.presetCategoryId);

  const categories = useSelectableCategories();
  const recentIds = useRecentCategoryIds();
  const {
    addVariable, updateVariable, deleteVariable,
    addFixed, updateFixed, deleteFixed,
  } = useDataStore.getState();

  const isEditing = editingVariable !== null || editingFixed !== null;

  const [mode, setMode] = useState<EntryMode>(storeMode);
  const [euros, setEuros] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<string>('');
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [interval, setIntervalValue] = useState<RecurrenceInterval>('monthly');
  const [dueDay, setDueDay] = useState(1);
  const [startDate, setStartDate] = useState(startOfCurrentMonthIso());
  const [touched, setTouched] = useState(false);

  // Beim Oeffnen einmal aus dem Datensatz bzw. aus Vorgaben befuellen.
  useEffect(() => {
    if (!open) return;
    setTouched(false);
    if (editingVariable) {
      setMode('variable');
      setEuros(editingVariable.amountCents / 100);
      setCategoryId(editingVariable.categoryId);
      setDate(editingVariable.date);
      setNote(editingVariable.note);
    } else if (editingFixed) {
      setMode('fixed');
      setEuros(editingFixed.amountCents / 100);
      setCategoryId(editingFixed.categoryId);
      setIntervalValue(editingFixed.interval);
      setDueDay(editingFixed.dueDay);
      setStartDate(editingFixed.startDate);
      setNote(editingFixed.note);
    } else {
      setMode(storeMode);
      setEuros(null);
      setCategoryId(presetCategoryId ?? recentIds[0] ?? categories[0]?.id ?? '');
      setDate(todayIso());
      setIntervalValue('monthly');
      setDueDay(1);
      setStartDate(startOfCurrentMonthIso());
      setNote('');
    }
    // Nur beim Oeffnen neu befuellen - sonst wuerde jede Eingabe zurueckgesetzt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const amountCents = euros === null ? 0 : Math.round(euros * 100);
  const valid = amountCents > 0 && categoryId !== '';

  // Kategorien: zuletzt benutzte zuerst, der Rest alphabetisch dahinter.
  const orderedCategories = useMemo(() => {
    const recent = recentIds
      .map((id) => categories.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => c !== undefined);
    const rest = categories.filter((c) => !recentIds.includes(c.id));
    return [...recent, ...rest];
  }, [categories, recentIds]);

  const isWeekBased = interval === 'weekly' || interval === 'biweekly';

  const preview = useMemo(() => {
    if (mode !== 'fixed' || amountCents <= 0) return null;
    const draft: FixedExpense = {
      id: 'preview', createdAt: '', updatedAt: '', deletedAt: null,
      interval, categoryId, amountCents, dueDay, note: '',
      startDate, endDate: null,
    };
    const monthly = monthlyCents(draft);
    const next = nextDueDate(draft, todayIso());
    return {
      monthly: formatMoney(Math.round(monthly)),
      next: next ? formatFullDate(next) : null,
    };
  }, [mode, amountCents, interval, dueDay, startDate, categoryId]);

  function reset() {
    setEuros(null);
    setNote('');
    setTouched(false);
  }

  async function save(keepOpen: boolean) {
    setTouched(true);
    if (!valid) return;

    if (mode === 'variable') {
      if (editingVariable) {
        await updateVariable(editingVariable.id, { date, categoryId, amountCents, note });
        toast('Gespeichert');
      } else {
        await addVariable({ date, categoryId, amountCents, note });
        toast('Gespeichert');
      }
    } else {
      const payload = {
        interval, categoryId, amountCents,
        dueDay: isWeekBased ? Math.min(dueDay, 7) : dueDay,
        note, startDate, endDate: null,
      };
      if (editingFixed) {
        await updateFixed(editingFixed.id, payload);
        toast('Gespeichert');
      } else {
        await addFixed(payload);
        toast('Fixkosten gespeichert');
      }
    }

    if (keepOpen) reset();
    else close();
  }

  async function remove() {
    if (editingVariable) {
      await deleteVariable(editingVariable.id);
    } else if (editingFixed) {
      await deleteFixed(editingFixed.id);
    }
    close();
    // Sofort loeschen statt nachfragen - im Normalfall schneller, im
    // Fehlerfall genauso sicher, weil sich die Aktion zuruecknehmen laesst.
    toast('Gelöscht', {
      actionLabel: 'Rückgängig',
      onAction: () => void useDataStore.getState().undoDelete(),
    });
  }

  return (
    <Drawer.Root open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <Drawer.Portal>
        <Drawer.Backdrop className={s.backdrop} />
        <Drawer.Viewport className={s.viewport}>
          <Drawer.Popup className={s.popup}>
            <Drawer.VirtualKeyboardProvider>
              <Drawer.Content className={s.content}>
                <div className={s.handle} aria-hidden />

                <div className={s.header}>
                  <div className={s.headerRow}>
                    <Drawer.Title className={s.title}>
                      {isEditing
                        ? mode === 'fixed' ? 'Fixkosten bearbeiten' : 'Ausgabe bearbeiten'
                        : 'Neue Ausgabe'}
                    </Drawer.Title>
                    <Drawer.Close className="btn btn--icon" aria-label="Schließen">
                      <X size={20} aria-hidden />
                    </Drawer.Close>
                  </div>

                  {!isEditing && (
                    <SegmentedControl<EntryMode>
                      value={mode}
                      options={MODE_OPTIONS}
                      onChange={setMode}
                      ariaLabel="Art der Ausgabe"
                    />
                  )}
                </div>

                <div className={s.body}>
                  {/* Betrag zuerst und mit Autofokus: das ist das Feld, das
                      bei jeder Erfassung ausgefuellt wird. */}
                  <NumberField.Root
                    value={euros}
                    onValueChange={setEuros}
                    locale="de-DE"
                    format={{ style: 'currency', currency: 'EUR' }}
                    min={0}
                    step={1}
                    smallStep={0.01}
                    largeStep={10}
                    className={s.amountField}
                  >
                    <label className="fieldLabel" htmlFor="entry-amount">Betrag</label>
                    <NumberField.Input
                      id="entry-amount"
                      className={s.amountInput}
                      placeholder="0,00 €"
                      autoFocus
                      inputMode="decimal"
                    />
                  </NumberField.Root>
                  {touched && amountCents <= 0 && (
                    <p className="fieldError">Bitte einen Betrag größer als 0 eingeben.</p>
                  )}

                  {mode === 'variable' ? (
                    <div>
                      <span className="fieldLabel">Datum</span>
                      <div className={s.dateRow}>
                        <button
                          type="button"
                          className="chip"
                          data-selected={date === todayIso() ? '' : undefined}
                          onClick={() => setDate(todayIso())}
                        >
                          Heute
                        </button>
                        <button
                          type="button"
                          className="chip"
                          data-selected={date === yesterdayIso() ? '' : undefined}
                          onClick={() => setDate(yesterdayIso())}
                        >
                          Gestern
                        </button>
                        <span className={s.dateInput}>
                          <DatePicker
                            value={date}
                            max={todayIso()}
                            onChange={setDate}
                            ariaLabel="Datum"
                          />
                        </span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className={s.grid2}>
                        <div>
                          <label className="fieldLabel" htmlFor="entry-interval">Wiederholung</label>
                          <Select<RecurrenceInterval>
                            id="entry-interval"
                            value={interval}
                            options={INTERVAL_OPTIONS}
                            onChange={setIntervalValue}
                          />
                        </div>

                        <div>
                          <label className="fieldLabel" htmlFor="entry-dueday">
                            {isWeekBased ? 'Wochentag' : 'Abbuchungstag'}
                          </label>
                          <Select<number>
                            id="entry-dueday"
                            value={isWeekBased ? Math.min(dueDay, 7) : dueDay}
                            options={isWeekBased ? WEEKDAY_OPTIONS : DAY_OF_MONTH_OPTIONS}
                            onChange={setDueDay}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="fieldLabel" htmlFor="entry-start">Läuft seit</label>
                        <DatePicker
                          id="entry-start"
                          value={startDate}
                          onChange={setStartDate}
                        />
                        <p className="fieldHint">
                          Frühere Zeiträume bleiben unberührt — die Kosten zählen erst ab diesem Datum.
                        </p>
                      </div>

                      {preview && (
                        <p className={s.preview}>
                          ≈ {preview.monthly} pro Monat
                          {preview.next && <> · nächste Abbuchung {preview.next}</>}
                        </p>
                      )}
                    </>
                  )}

                  <div>
                    <label className="fieldLabel" htmlFor="entry-note">Notiz</label>
                    <textarea
                      id="entry-note"
                      className="textarea"
                      value={note}
                      maxLength={280}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="z. B. Rewe, Wocheneinkauf"
                    />
                  </div>

                  <div>
                    <span className="fieldLabel">Kategorie</span>
                    <div className={s.categoryGrid} role="radiogroup" aria-label="Kategorie">
                      {orderedCategories.map((category) => {
                        const selected = category.id === categoryId;
                        return (
                          <button
                            key={category.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            className={`${s.categoryTile} ${selected ? s.categoryTileSelected : ''}`}
                            style={categoryColorVars(category.color)}
                            onClick={() => setCategoryId(category.id)}
                          >
                            <CategoryIcon name={category.icon} size={20} />
                            <span className={s.categoryTileLabel}>{category.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {isEditing && (
                    <div className={s.deleteRow}>
                      <button type="button" className="btn btn--danger" onClick={() => void remove()}>
                        <Trash2 size={18} aria-hidden />
                        Löschen
                      </button>
                    </div>
                  )}
                </div>

                <div className={s.footer}>
                  <div className={s.footerRow}>
                    {!isEditing && (
                      <button
                        type="button"
                        className="btn btn--secondary"
                        onClick={() => void save(true)}
                        disabled={!valid}
                      >
                        Speichern &amp; neu
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => void save(false)}
                      disabled={!valid}
                    >
                      Speichern
                    </button>
                  </div>
                </div>
              </Drawer.Content>
            </Drawer.VirtualKeyboardProvider>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
