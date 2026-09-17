import type { CSSProperties } from 'react';
import type { ColorScale } from '@/data/colorScales';

/** Die einzige Stelle, an der ausserhalb von theme.css auf Radix-Variablen
 *  zugegriffen wird. Noetig, weil die Kategoriefarbe aus den Daten kommt
 *  und nicht statisch im CSS stehen kann.
 *
 *  Warum Stufe 11 und nicht die "Markenstufe" 9:
 *  Stufe 9 hat die hoechste Saettigung, aber keinen garantierten Kontrast
 *  zur App-Flaeche. Gegen sand-1 gemessen fallen im HELLEN Modus fuenf der
 *  vierzehn Kategoriefarben unter 3:1 - yellow auf 1.24:1 und lime auf
 *  1.32:1 sind auf Weiss praktisch unsichtbar.
 *  Stufe 11 ist genau fuer farbigen Vordergrund auf ruhigem Grund gebaut
 *  und liegt bei allen 21 Skalen ueber 4.4:1 (hell) bzw. 8.9:1 (dunkel).
 *
 *  Stufe 9 bleibt als `--cat-solid` verfuegbar - dort, wo die Farbe auf
 *  ihrem EIGENEN weichen Untergrund sitzt (Stufe 3) statt auf der App-Flaeche.
 */
export function categoryColorVars(scale: ColorScale): CSSProperties {
  return {
    '--cat-fg': `var(--${scale}-11)`,
    // Fuer TEXT auf --cat-bg reicht Stufe 11 nicht: gemessen ueber alle 21
    // Skalen kommt orange im hellen Modus auf 3,99:1 und verfehlt AA. Keine
    // Kombination aus Stufe 11 und einer getoenten Flaeche besteht dort -
    // selbst auf Stufe 1 bleibt orange bei 4,41:1. Stufe 12 liegt bei 9,8:1.
    '--cat-text': `var(--${scale}-12)`,
    '--cat-solid': `var(--${scale}-9)`,
    '--cat-bg': `var(--${scale}-3)`,
    '--cat-bg-hover': `var(--${scale}-4)`,
    '--cat-border': `var(--${scale}-6)`,
  } as CSSProperties;
}
