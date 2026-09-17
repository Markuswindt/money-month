/** WCAG-Kontrastberechnung auf den TATSAECHLICH gerenderten Farben.
 *
 *  Absicht: die Werte werden nicht aus einer Tabelle abgeschrieben, sondern
 *  im laufenden Theme gemessen. Dadurch faellt sofort auf, wenn ein Token
 *  im Dunkelmodus kippt - der haeufigste Weg, wie ein Farbsystem unbemerkt
 *  unter die Schwelle rutscht.
 */

type Rgb = [number, number, number];

function parseColor(value: string): Rgb | null {
  const m = value.match(/-?[\d.]+/g);
  if (!m || m.length < 3) return null;
  const [r, g, b] = m;
  if (r === undefined || g === undefined || b === undefined) return null;
  return [Number(r), Number(g), Number(b)];
}

function channelLuminance(c255: number): number {
  const c = c255 / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: Rgb): number {
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Loest einen CSS-Ausdruck wie `var(--cyan-11)` im aktuellen Theme auf. */
export function resolveColor(cssValue: string): Rgb | null {
  const probe = document.createElement('span');
  probe.style.color = cssValue;
  probe.style.position = 'absolute';
  probe.style.opacity = '0';
  probe.style.pointerEvents = 'none';
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  return parseColor(computed);
}

/** Kontrast zweier CSS-Ausdruecke im aktuellen Theme. null, wenn eine
 *  der Farben nicht aufloesbar war. */
export function measureContrast(fg: string, bg: string): number | null {
  const a = resolveColor(fg);
  const b = resolveColor(bg);
  if (!a || !b) return null;
  return contrastRatio(a, b);
}
