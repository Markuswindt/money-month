/** Radix-Farbskalen, die eine Kategorie tragen darf.
 *
 *  Nicht in dieser Liste und bewusst nicht waehlbar:
 *    gold   - Akzentfarbe der App
 *    sand   - Neutralton
 *    red    - destruktive Aktionen
 *    amber  - Warnungen
 *    bronze - zu nah an gold, nebeneinander kaum zu trennen
 */
export const CATEGORY_SCALES = [
  'cyan', 'orange', 'plum', 'grass', 'blue', 'violet', 'pink',
  'teal', 'crimson', 'yellow', 'brown', 'lime', 'purple', 'indigo',
  // Reserve fuer selbst angelegte Kategorien:
  'tomato', 'ruby', 'iris', 'jade', 'green', 'mint', 'sky',
] as const;

export type ColorScale = (typeof CATEGORY_SCALES)[number];

export function isColorScale(value: string): value is ColorScale {
  return (CATEGORY_SCALES as readonly string[]).includes(value);
}

/** Naechste Skala, die noch keine Kategorie belegt. Sind alle vergeben,
 *  faellt sie auf die erste zurueck - doppelte Farben sind haesslich,
 *  aber besser als eine Kategorie ohne Farbe. */
export function nextFreeScale(used: readonly ColorScale[]): ColorScale {
  return CATEGORY_SCALES.find((s) => !used.includes(s)) ?? CATEGORY_SCALES[0];
}
