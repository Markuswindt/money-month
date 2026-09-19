import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import { useUiStore } from '@/store/uiStore';
import { usePeriodsWithData } from '@/store/selectors';
import { periodLabel, periodStripLabel } from '@/lib/periods';
import s from './PeriodNav.module.css';

/** Ab wie vielen Pixeln waagerechter Bewegung ein Wisch als Blaettern zaehlt. */
const SWIPE_COMMIT = 40;
/** Vorher steht die Richtung der Geste noch nicht fest. */
const SWIPE_DECIDE = 8;
/** Waagerecht nur, wenn die Bewegung deutlich waagerechter als senkrecht ist. */
const SWIPE_RATIO = 1.5;
/** Linker Rand, der dem iOS-Zurueckwischen gehoert. */
const EDGE_GUARD = 24;

const centerOf = (el: HTMLElement) => el.offsetLeft + el.offsetWidth / 2;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type Center = { key: string; center: number };

/**
 * Perioden als einrastender Streifen.
 *
 * Statt zweier Chevrons, die je einen Schritt weiterzaehlen, stehen die
 * Nachbarperioden sichtbar daneben - man sieht den Kontext, statt ihn zu
 * erraten, und kann mehrere Schritte in einer Bewegung zuruecklegen.
 *
 * Die Auswahl folgt der Scrollposition LAUFEND: sobald ein Eintrag der Mitte
 * am naechsten kommt, ist er gewaehlt - auch mitten im Schwung, nicht erst
 * im Stillstand. Das Einrasten per CSS-Snap sorgt nur noch fuer die saubere
 * Endlage und haelt die Auswahl nicht mehr auf.
 *
 * Saemtliche Geometrie kommt aus offsetLeft/offsetWidth statt aus einer
 * Token-Rechnung. Aendert sich spaeter Breite, Abstand oder Innenabstand der
 * Eintraege, rechnet das hier ohne Zutun weiter richtig.
 */
export function PeriodStrip({ includeFixed = true }: { includeFixed?: boolean }) {
  const period = useUiStore((st) => st.period);
  const setPeriod = useUiStore((st) => st.setPeriod);

  const periods = usePeriodsWithData(period, includeFixed);

  const stripRef = useRef<HTMLDivElement>(null);
  const firstRenderRef = useRef(true);
  const lastTypeRef = useRef(period.type);
  /** Die Mitten der Eintraege, einmal gemessen statt pro Frame gelesen. */
  const centersRef = useRef<Center[]>([]);
  /** Welche Auswahl aus dem Scrollen selbst kam - die darf nicht zurueckscrollen. */
  const fromScrollRef = useRef<string | null>(null);

  // Was der Scroll-Handler braucht, ohne ihn dafuer neu aufzusetzen. Bei
  // laufender Auswahl aendert sich die Periode viele Male pro Sekunde; ein
  // Listener, der daran haengt, wuerde genauso oft ab- und wieder angemeldet.
  const periodsRef = useRef(periods);
  periodsRef.current = periods;
  const currentKeyRef = useRef(period.key);
  currentKeyRef.current = period.key;
  const setPeriodRef = useRef(setPeriod);
  setPeriodRef.current = setPeriod;

  const measure = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    centersRef.current = Array.from(
      strip.querySelectorAll<HTMLElement>('[data-strip-item]'),
      (el) => ({ key: el.dataset['stripItem'] ?? '', center: centerOf(el) }),
    );
  }, []);

  const nearestTo = useCallback((viewCenter: number): Center | undefined => {
    let best: Center | undefined;
    let bestDistance = Infinity;
    for (const entry of centersRef.current) {
      const distance = Math.abs(entry.center - viewCenter);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = entry;
      }
    }
    return best;
  }, []);

  const scrollToKey = useCallback((key: string, behavior: ScrollBehavior) => {
    const strip = stripRef.current;
    if (!strip) return;
    const entry = centersRef.current.find((c) => c.key === key);
    if (!entry) return;
    strip.scrollTo({ left: entry.center - strip.clientWidth / 2, behavior });
  }, []);

  // Die Fuellstuecke an den Enden sind prozentual zur Containerbreite, also
  // verschieben sich bei einer Groessenaenderung ALLE Mitten. Deshalb neu
  // messen, wenn sich das Fenster oder die Breite aendert - und nur dann.
  useLayoutEffect(() => { measure(); }, [measure, periods]);
  useEffect(() => {
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measure]);

  // Zustand -> Scrollposition. Beim ersten Rendern und nach einem Typwechsel
  // ohne Animation, weil dort nicht geblaettert, sondern neu aufgebaut wird.
  useEffect(() => {
    // Kam die Auswahl aus dem Scrollen, ist die Position bereits richtig.
    // Ohne diese Bremse wuerde jeder Wechsel mitten im Schwung ein
    // scrollTo ausloesen und gegen den eigenen Finger arbeiten.
    if (fromScrollRef.current === period.key) {
      fromScrollRef.current = null;
      return;
    }
    fromScrollRef.current = null;
    const instant =
      firstRenderRef.current || lastTypeRef.current !== period.type || prefersReducedMotion();
    firstRenderRef.current = false;
    lastTypeRef.current = period.type;
    scrollToKey(period.key, instant ? 'auto' : 'smooth');
  }, [period.key, period.type, periods, scrollToKey]);

  // Scrollposition -> Zustand, laufend.
  //
  // Auf rAF gedrosselt, damit pro Bild hoechstens einmal gerechnet wird, und
  // nur bei echtem Wechsel gesetzt, damit nicht jedes Bild ein Re-Render
  // ausloest. Gelesen wird aus der Messung, nicht aus dem DOM: das Rendern
  // der aktiven Pille macht das Layout ungueltig, und ein offsetLeft direkt
  // danach wuerde den Browser mitten im Scrollen zu einem Zwangs-Layout
  // treiben - genau in dem Moment, in dem es fluessig bleiben muss.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const el = stripRef.current;
        if (!el) return;
        const best = nearestTo(el.scrollLeft + el.clientWidth / 2);
        if (!best || best.key === currentKeyRef.current) return;
        const next = periodsRef.current.find((p) => p.key === best.key);
        if (!next) return;
        fromScrollRef.current = next.key;
        setPeriodRef.current(next);
      });
    };
    strip.addEventListener('scroll', onScroll, { passive: true });
    return () => strip.removeEventListener('scroll', onScroll);
  }, [nearestTo]);

  // Wischen ueber den Seiteninhalt blaettert.
  //
  // Der Finger treibt direkt scrollLeft des Streifens - kein transform auf
  // der Seite, kein nachgebautes Gummiband. Der Scroll-Container ist das
  // Gummiband, und das Einrasten uebernimmt danach die CSS-Snap-Regel.
  // Weil der Streifen dabei wirklich scrollt, laeuft die Auswahl schon
  // waehrend des Ziehens mit - dieselbe Mechanik wie beim direkten Scrollen.
  //
  // Die Effekt-Abhaengigkeiten sind leer: alles, was die Geste braucht,
  // steht in der Messung. Damit bleiben die Listener ueber Periodenwechsel
  // hinweg registriert, statt bei jedem Wisch neu aufgebaut zu werden.
  useEffect(() => {
    const strip = stripRef.current;
    const page = strip?.closest<HTMLElement>('[data-period-swipe]');
    if (!strip || !page) return;

    let pointerId = -1;
    let decided = false;
    let horizontal = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startKey: string | undefined;

    const reset = () => {
      pointerId = -1;
      decided = false;
      horizontal = false;
    };

    const onDown = (e: PointerEvent) => {
      // Mit der Maus gibt es die Chevrons und die Pfeiltasten; ein Ziehen
      // waere dort eine Ueberraschung statt einer Hilfe.
      if (e.pointerType === 'mouse') return;
      if (e.clientX < EDGE_GUARD) return;
      const target = e.target as Element | null;
      // Ein Wisch, der auf dem Streifen selbst beginnt, wird nativ
      // gescrollt - unser Listener haengt am Elternelement und saehe ihn
      // sonst ein zweites Mal.
      if (target?.closest('[data-strip-scroll]')) return;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = strip.scrollLeft;
      startKey = undefined;
      decided = false;
      horizontal = false;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!decided) {
        if (Math.abs(dx) < SWIPE_DECIDE && Math.abs(dy) < SWIPE_DECIDE) return;
        decided = true;
        horizontal = Math.abs(dx) > Math.abs(dy) * SWIPE_RATIO;
        if (!horizontal) {
          // Senkrecht: die Geste gehoert dem Seiten-Scrollen.
          reset();
          return;
        }
        startKey = nearestTo(strip.scrollLeft + strip.clientWidth / 2)?.key;
      }
      if (!horizontal) return;
      strip.scrollLeft = startLeft - dx;
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      const wasHorizontal = horizontal;
      const key = startKey;
      reset();
      if (!wasHorizontal || !key) return;

      const centers = centersRef.current;
      const from = centers.findIndex((c) => c.key === key);
      if (from < 0) return;
      // Nach links wischen holt die neuere Periode - dieselbe Richtung, in
      // die sich der Streifen bewegt.
      const delta = dx <= -SWIPE_COMMIT ? 1 : dx >= SWIPE_COMMIT ? -1 : 0;
      const to = Math.min(Math.max(from + delta, 0), centers.length - 1);
      const target = centers[to];
      if (!target) return;
      strip.scrollTo({
        left: target.center - strip.clientWidth / 2,
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
    };

    const onCancel = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      reset();
    };

    page.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onCancel, { passive: true });
    return () => {
      page.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [nearestTo]);

  return (
    <ToggleGroup
      ref={stripRef}
      data-strip-scroll=""
      className={s.strip}
      aria-label="Zeitraum wählen"
      loopFocus={false}
      value={[period.key]}
      onValueChange={(next) => {
        const key = next[0];
        const picked = key ? periods.find((p) => p.key === key) : undefined;
        if (picked) setPeriod(picked);
      }}
    >
      {periods.map((p) => {
        const { primary, secondary } = periodStripLabel(p);
        return (
          <Toggle
            key={p.key}
            value={p.key}
            data-strip-item={p.key}
            className={s.stripItem}
            aria-label={periodLabel(p)}
            // Der Fokus waehlt mit, statt nur zu wandern. Base UI bewegt mit
            // den Pfeiltasten den Fokus und erwartet danach die Leertaste -
            // fuer eine Einfachauswahl ist das der falsche Takt.
            onFocus={() => { if (p.key !== period.key) setPeriod(p); }}
          >
            <span className={s.stripPrimary}>{primary}</span>
            {secondary && <span className={s.stripSecondary}>{secondary}</span>}
          </Toggle>
        );
      })}
    </ToggleGroup>
  );
}
