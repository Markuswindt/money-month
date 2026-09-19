import type { CSSProperties } from 'react';
import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';

/**
 * Segmentierte Umschaltung fuer genau eine Auswahl (Woche/Monat/Jahr,
 * Filterzustand). Base UI liefert die Tastaturbedienung und die
 * data-pressed-Zustaende, das Aussehen kommt aus components.css.
 *
 * Die aktive Flaeche ist dort ein gleitendes Pseudoelement. Es braucht nur
 * zwei Zahlen: wie viele Segmente es gibt und das wievielte gewaehlt ist.
 * Beides steht hier, weil nur die Komponente die Optionen kennt - gerechnet
 * wird ausschliesslich in CSS.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string | undefined;
}) {
  const index = options.findIndex((option) => option.value === value);

  return (
    <ToggleGroup
      aria-label={ariaLabel}
      style={{
        '--seg-count': options.length,
        // Ohne Treffer (-1) bliebe der Thumb links vor dem ersten Segment
        // stehen; 0 laesst ihn wenigstens auf einem sitzen.
        '--seg-index': Math.max(index, 0),
      } as CSSProperties}
      value={[value]}
      onValueChange={(next) => {
        // Leeres Array = der aktive Knopf wurde erneut gedrueckt. Bei einer
        // Einfachauswahl bleibt die bisherige Wahl dann einfach bestehen.
        const picked = next[0] as T | undefined;
        if (picked) onChange(picked);
      }}
      className={className ? `segmented ${className}` : 'segmented'}
    >
      {options.map((option) => (
        <Toggle key={option.value} value={option.value} className="segmented__item">
          {option.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
