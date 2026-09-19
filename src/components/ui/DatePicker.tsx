import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Popover } from '@base-ui/react/popover';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameMonth, startOfMonth, startOfWeek,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { formatFullDate, formatMonthHeading, fromIsoDate, toIsoDate, todayIso } from '@/lib/periods';

const WEEK_OPTIONS = { weekStartsOn: 1 } as const; // Montag

/** Mo-So, einmal aus der Locale erzeugt statt als Literal gepflegt. Das
 *  Bezugsdatum ist fest, damit die Namen nicht vom heutigen Tag abhaengen. */
const WEEKDAYS = eachDayOfInterval({
  start: startOfWeek(new Date(2024, 0, 1), WEEK_OPTIONS),
  end: endOfWeek(new Date(2024, 0, 1), WEEK_OPTIONS),
}).map((day) => ({
  short: format(day, 'EEEEEE', { locale: de }),
  long: format(day, 'EEEE', { locale: de }),
}));

const KEY_DELTAS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

/**
 * Datumsauswahl als Monatsraster.
 *
 * Ersetzt <input type="date">. Das native Feld war auf jeder Plattform ein
 * anderes Bauteil - auf iOS ein Rad, auf dem Desktop ein Browser-Popup -
 * und liess sich weder an die Typografie noch an die Flaechen der App
 * angleichen.
 *
 * Basiert auf dem gleichen Popover wie der Select, damit es im Bottom Sheet
 * ueber dem Blatt liegt und per Escape bzw. Tippen daneben schliesst.
 */
export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  ariaLabel,
}: {
  id?: string | undefined;
  value: string;
  onChange: (iso: string) => void;
  min?: string | undefined;
  max?: string | undefined;
  ariaLabel?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  /** Irgendein Tag im gerade gezeigten Monat. */
  const [viewIso, setViewIso] = useState(value);
  /** Der Tag, der den Tabstopp traegt - Roving Tabindex ueber das Raster. */
  const [focusedIso, setFocusedIso] = useState(value);

  const selectedRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const movedByKey = useRef(false);

  const today = todayIso();

  const outOfRange = (iso: string) =>
    (min !== undefined && iso < min) || (max !== undefined && iso > max);

  const weeks = useMemo(() => {
    const ref = fromIsoDate(viewIso);
    const days = eachDayOfInterval({
      start: startOfWeek(startOfMonth(ref), WEEK_OPTIONS),
      end: endOfWeek(endOfMonth(ref), WEEK_OPTIONS),
    });
    const out: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7));
    return out;
  }, [viewIso]);

  // Nach einem Tastendruck den Fokus dem Raster nachziehen. Ohne das bliebe
  // er auf dem alten Tag stehen und die Pfeiltasten waeren wirkungslos.
  useEffect(() => {
    if (!movedByKey.current) return;
    movedByKey.current = false;
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-iso="${focusedIso}"]`)
      ?.focus();
  }, [focusedIso]);

  function moveFocus(next: Date) {
    const iso = toIsoDate(next);
    // Ausserhalb der erlaubten Spanne bleibt der Fokus stehen, statt auf
    // einem deaktivierten Tag zu landen, den man nicht waehlen kann.
    if (outOfRange(iso)) return;
    movedByKey.current = true;
    setFocusedIso(iso);
    if (!isSameMonth(next, fromIsoDate(viewIso))) setViewIso(iso);
  }

  function onGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = fromIsoDate(focusedIso);
    const delta = KEY_DELTAS[event.key];

    let next: Date | null = null;
    if (delta !== undefined) next = addDays(current, delta);
    else if (event.key === 'Home') next = startOfWeek(current, WEEK_OPTIONS);
    else if (event.key === 'End') next = endOfWeek(current, WEEK_OPTIONS);
    else if (event.key === 'PageUp') next = addMonths(current, -1);
    else if (event.key === 'PageDown') next = addMonths(current, 1);

    if (!next) return;
    event.preventDefault();
    moveFocus(next);
  }

  function pick(iso: string) {
    onChange(iso);
    setOpen(false);
  }

  function shiftMonth(delta: number) {
    setViewIso(toIsoDate(addMonths(fromIsoDate(viewIso), delta)));
  }

  // Ein Monatsschritt ist sinnlos, wenn der ganze Zielmonat ausserhalb der
  // Spanne liegt - der Knopf wird dann deaktiviert statt ins Leere zu fuehren.
  const prevMonthEnd = toIsoDate(endOfMonth(addMonths(fromIsoDate(viewIso), -1)));
  const nextMonthStart = toIsoDate(startOfMonth(addMonths(fromIsoDate(viewIso), 1)));

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Beim Oeffnen immer beim gewaehlten Tag beginnen, nicht dort, wo
        // man das Raster zuletzt verlassen hat.
        if (next) {
          setViewIso(value);
          setFocusedIso(value);
        }
      }}
    >
      <Popover.Trigger
        {...(id ? { id } : {})}
        {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
        className="select"
      >
        <span className="select__value">
          {format(fromIsoDate(value), 'd. MMM yyyy', { locale: de })}
        </span>
        <span className="datePicker__icon">
          <CalendarDays strokeWidth={1.75} aria-hidden />
        </span>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner className="calendarPositioner" sideOffset={4} align="start">
          <Popover.Popup className="calendarPopup" initialFocus={selectedRef}>
            <div className="calendarHeader">
              <button
                type="button"
                className="btn btn--icon calendarNav"
                onClick={() => shiftMonth(-1)}
                disabled={min !== undefined && prevMonthEnd < min}
                aria-label="Vorheriger Monat"
              >
                <ChevronLeft size={20} aria-hidden />
              </button>
              <span className="calendarMonth" aria-live="polite">
                {formatMonthHeading(viewIso)}
              </span>
              <button
                type="button"
                className="btn btn--icon calendarNav"
                onClick={() => shiftMonth(1)}
                disabled={max !== undefined && nextMonthStart > max}
                aria-label="Nächster Monat"
              >
                <ChevronRight size={20} aria-hidden />
              </button>
            </div>

            <div
              className="calendarGrid"
              role="grid"
              aria-label={formatMonthHeading(viewIso)}
              ref={gridRef}
              onKeyDown={onGridKeyDown}
            >
              <div className="calendarRow" role="row">
                {WEEKDAYS.map((day) => (
                  <span
                    key={day.short}
                    className="calendarWeekday"
                    role="columnheader"
                    aria-label={day.long}
                  >
                    {day.short}
                  </span>
                ))}
              </div>

              {weeks.map((week) => (
                <div className="calendarRow" role="row" key={toIsoDate(week[0]!)}>
                  {week.map((day) => {
                    const iso = toIsoDate(day);
                    const selected = iso === value;
                    return (
                      <button
                        key={iso}
                        type="button"
                        role="gridcell"
                        data-iso={iso}
                        className="calendarDay"
                        data-outside={isSameMonth(day, fromIsoDate(viewIso)) ? undefined : ''}
                        data-today={iso === today ? '' : undefined}
                        aria-selected={selected}
                        aria-label={formatFullDate(iso)}
                        disabled={outOfRange(iso)}
                        tabIndex={iso === focusedIso ? 0 : -1}
                        ref={selected ? selectedRef : undefined}
                        onClick={() => pick(iso)}
                      >
                        {format(day, 'd', { locale: de })}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
