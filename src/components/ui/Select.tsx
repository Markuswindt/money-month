import { Select as BaseSelect } from '@base-ui/react/select';
import { Check, ChevronDown } from 'lucide-react';

export type SelectOption<T extends string | number> = {
  value: T;
  label: string;
};

/**
 * Auswahlfeld im Stil der App.
 *
 * Ersetzt das native <select>. Das sah auf jeder Plattform anders aus und
 * zeichnete seinen Pfeil ausserhalb der eigenen Polsterung direkt an die
 * Kante - er liess sich weder positionieren noch an die Groesse der
 * uebrigen Symbole angleichen.
 *
 * Base UI liefert Tastaturbedienung, Typeahead und Fokusverwaltung mit;
 * hier steht nur das Aussehen.
 */
export function Select<T extends string | number>({
  id,
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = 'Bitte wählen',
}: {
  id?: string | undefined;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel?: string | undefined;
  placeholder?: string | undefined;
}) {
  return (
    <BaseSelect.Root
      value={value}
      onValueChange={(next) => {
        // null kommt nur vor, wenn die Auswahl geleert werden kann - hier
        // gibt es immer einen gueltigen Wert, also ignorieren.
        if (next !== null) onChange(next as T);
      }}
    >
      <BaseSelect.Trigger
        {...(id ? { id } : {})}
        {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
        className="select"
      >
        <BaseSelect.Value className="select__value">
          {(current) =>
            options.find((o) => o.value === current)?.label ?? placeholder
          }
        </BaseSelect.Value>
        <BaseSelect.Icon className="select__icon">
          <ChevronDown strokeWidth={1.75} aria-hidden />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>

      <BaseSelect.Portal>
        <BaseSelect.Positioner
          className="selectPositioner"
          sideOffset={4}
          /* Ausgeklappt wird unter dem Feld, nicht darueber gelegt: im
             Bottom Sheet ist der Platz knapp und eine ueber dem Ausloeser
             schwebende Liste verdeckt genau das Feld, das man gerade
             bedient. */
          alignItemWithTrigger={false}
        >
          <BaseSelect.Popup className="selectPopup">
            <BaseSelect.List>
              {options.map((option) => (
                <BaseSelect.Item
                  key={option.value}
                  value={option.value}
                  className="selectItem"
                >
                  <BaseSelect.ItemText className="selectItem__text">
                    {option.label}
                  </BaseSelect.ItemText>
                  <BaseSelect.ItemIndicator className="selectItem__check">
                    <Check strokeWidth={2} aria-hidden />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
