import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';

/**
 * Segmentierte Umschaltung fuer genau eine Auswahl (Woche/Monat/Jahr,
 * Filterzustand). Base UI liefert die Tastaturbedienung und die
 * data-pressed-Zustaende, das Aussehen kommt aus components.css.
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
  return (
    <ToggleGroup
      aria-label={ariaLabel}
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
