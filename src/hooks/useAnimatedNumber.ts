import { useEffect, useRef, useState } from 'react';

const DURATION = 450;
/** Verkuerzte Laufzeit, wenn das Ziel waehrend der Fahrt erneut wechselt. */
const DURATION_CHASE = 140;
/** Ab wann ein Wechsel als "hinterher" statt als neuer Vorgang zaehlt. */
const CHASE_WINDOW = 400;

/** Stark ausklingend: der Grossteil der Strecke liegt in den ersten 150 ms,
 *  danach kriecht die Zahl nur noch auf den Endwert zu. Ein gleichmaessiger
 *  Verlauf wirkt bei Zahlen traege, weil man das Ende kommen sieht. */
function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - 2 ** (-10 * t);
}

/**
 * Zaehlt auf einen neuen Wert hoch, statt ihn auszutauschen.
 *
 * Gedacht fuer die grosse Periodensumme: dort macht der Uebergang sichtbar,
 * DASS sich etwas geaendert hat, und in welche Richtung. In Listen waere das
 * Unruhe - deshalb steckt das hier und nicht in `Money`.
 *
 * Gibt ganzzahlige Cent zurueck. Die Anzeige laeuft ueber `Money` und damit
 * ueber `tabular-nums`, die Ziffern springen beim Zaehlen also nicht in der
 * Breite.
 */
export function useAnimatedNumber(target: number): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef(0);
  const lastChangeRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;

    // Beim ersten Aufbau und bei abgeschalteter Bewegung gibt es nichts zu
    // erzaehlen - dann steht die Zahl einfach da.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      fromRef.current = target;
      setValue(target);
      return;
    }

    const start = performance.now();
    // Beim Durchscrollen wechselt das Ziel mehrmals pro Sekunde. Mit der
    // vollen Laufzeit wuerde die Zahl der Auswahl dauerhaft hinterherjagen
    // und Zwischenwerte zeigen, die zu keiner Periode gehoeren. Folgt ein
    // Wechsel dicht auf den vorigen, wird deshalb nur noch kurz nachgezogen.
    const chasing = start - lastChangeRef.current < CHASE_WINDOW;
    const duration = chasing ? DURATION_CHASE : DURATION;
    lastChangeRef.current = start;

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const current = Math.round(from + (target - from) * easeOutExpo(t));
      fromRef.current = current;
      setValue(current);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target]);

  return value;
}
