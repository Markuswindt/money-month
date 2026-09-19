/**
 * Perioden-Auswahlstreifen.
 *
 * Geprueft wird nicht, ob der Streifen da ist, sondern ob die drei Wege zur
 * Periode - wischen, tippen, Tastatur - beim selben Ergebnis landen und ob
 * die Auswahl danach wirklich in der Mitte steht.
 *
 * Zwei Faelle sind es wert, dauerhaft bewacht zu werden:
 *
 * 1. Die Zentrierung rechnet mit offsetLeft, und offsetLeft misst gegen den
 *    offsetParent. Faellt position: relative vom Streifen weg, sitzt jeder
 *    Eintrag um das Seiten-Padding daneben - sichtbar wird das aber kaum,
 *    weil die Snap-Regel den Fehler wegbuegelt. Der Test misst deshalb die
 *    Abweichung in Pixeln, statt sich auf den Augenschein zu verlassen.
 *
 * 2. Eine senkrechte Wischbewegung darf NICHT blaettern. Das ist der
 *    haeufigste Fehler bei Wischgesten und faellt im Betrieb nur dadurch
 *    auf, dass das Scrollen sich zaeh anfuehlt.
 *
 * 3. Der Streifen bietet nur Zeitraeume an, in denen es etwas gibt - und
 *    "etwas" bedeutet je nach Bildschirm anderes: die Uebersicht rechnet
 *    Fixkosten mit, die Ausgabenliste nicht. Der Test geht deshalb jeden
 *    angebotenen Monat der Ausgabenliste durch und verlangt, dass dort
 *    wirklich Eintraege stehen. Eine leere Seite hinter einer waehlbaren
 *    Pille ist genau der Fehler, den diese Trennung verhindern soll.
 *
 * 4. Die Auswahl muss WAEHREND des Scrollens mitlaufen, nicht erst im
 *    Stillstand. Der Unterschied ist von aussen unsichtbar, sobald der
 *    Scroller steht - beide Varianten enden bei derselben Periode. Der Test
 *    tastet deshalb mitten in der Bewegung ab und verlangt, dass dort schon
 *    mehrere verschiedene Perioden durchlaufen wurden. Faellt jemand spaeter
 *    auf scrollend oder einen Debounce zurueck, faellt genau das hier auf.
 */
import { chromium, devices } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 14 Pro'], hasTouch: true });
const page = await ctx.newPage();

const errors = [];
let failures = 0;
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

function step(name, ok, extra = '') {
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FEHL'} ${name}${extra ? '  → ' + extra : ''}`);
}

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

/** Die sichtbare Auswahl steht als Ueberschrift nur fuer Screenreader da. */
const selected = () => page.locator('h1.visually-hidden').innerText();
const stripScrollLeft = () => page.locator('[data-strip-scroll]').evaluate((el) => el.scrollLeft);

/** Eine Zeigergeste ueber dem Seiteninhalt, wie sie ein Finger ausloest. */
async function drag(dx, dy = 0, steps = 12) {
  await page.evaluate(async ([dx, dy, steps]) => {
    const target = document.querySelector('[data-period-swipe] > section');
    const box = target.getBoundingClientRect();
    const x0 = 300;
    const y0 = box.top + box.height / 2;
    const ev = (x, y) => ({
      pointerId: 1, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true,
    });
    target.dispatchEvent(new PointerEvent('pointerdown', ev(x0, y0)));
    for (let i = 1; i <= steps; i++) {
      window.dispatchEvent(new PointerEvent('pointermove', ev(x0 + (dx * i) / steps, y0 + (dy * i) / steps)));
      await new Promise((r) => setTimeout(r, 10));
    }
    window.dispatchEvent(new PointerEvent('pointerup', ev(x0 + dx, y0 + dy)));
  }, [dx, dy, steps]);
  await page.waitForTimeout(900);
}

/** Wie weit die Mitte des gewaehlten Eintrags von der Streifenmitte abweicht. */
const centerOffset = () => page.evaluate(() => {
  const strip = document.querySelector('[data-strip-scroll]');
  const active = strip.querySelector('[data-strip-item][data-pressed]');
  const center = active.offsetLeft + active.offsetWidth / 2;
  return Math.abs(center - (strip.scrollLeft + strip.clientWidth / 2));
});

console.log('\n═══ Wischen ═══');
const start = await selected();
step('Startet beim laufenden Zeitraum', /September|Oktober|November|Dezember|Januar/.test(start), start);

await drag(-140);
step('Am Ende der Zeit blättert es nicht weiter', (await selected()) === start, await selected());

await drag(140);
const back1 = await selected();
step('Wisch nach rechts blättert zurück', back1 !== start, back1);

await drag(140);
const back2 = await selected();
step('Weiter zurück', back2 !== back1, back2);

await drag(-140);
step('Wisch nach links blättert wieder vor', (await selected()) === back1, await selected());

console.log('\n═══ Senkrechtes Scrollen bleibt unberührt ═══');
const keep = await selected();
const before = await stripScrollLeft();
await drag(10, 150);
step('Senkrechte Geste wechselt die Periode nicht', (await selected()) === keep, await selected());
step('Senkrechte Geste bewegt den Streifen nicht', Math.abs((await stripScrollLeft()) - before) < 2);

await drag(20);
step('Wisch unter der Schwelle rastet zurück', (await selected()) === keep, await selected());

console.log('\n═══ Live-Aktualisierung beim Scrollen ═══');
{
  const proben = await page.evaluate(async () => {
    const strip = document.querySelector('[data-strip-scroll]');
    const items = [...strip.querySelectorAll('[data-strip-item]')];
    const ziel = items[items.length - 9]; // acht Pillen zurueck
    const left = ziel.offsetLeft + ziel.offsetWidth / 2 - strip.clientWidth / 2;
    const out = [];
    strip.scrollTo({ left, behavior: 'smooth' });
    for (let i = 0; i < 24; i++) {
      await new Promise((r) => setTimeout(r, 25));
      out.push({
        x: Math.round(strip.scrollLeft),
        aktiv: strip.querySelector('[data-strip-item][data-pressed]')?.getAttribute('aria-label'),
        betrag: document.querySelector('[class*="heroAmount"]')?.textContent,
      });
    }
    return out;
  });

  // Nur die Proben zaehlen, bei denen sich der Scroller noch bewegt hat.
  const inBewegung = proben.filter((pr, i) => i > 0 && pr.x !== proben[i - 1].x);
  const perioden = new Set(inBewegung.map((pr) => pr.aktiv));
  const betraege = new Set(inBewegung.map((pr) => pr.betrag));

  step('Auswahl wechselt während der Scroller noch läuft',
    perioden.size > 2, `${perioden.size} Perioden in Bewegung`);
  step('Anzeige folgt der Auswahl live',
    betraege.size > 2, `${betraege.size} Beträge in Bewegung`);
  step('Endlage rastet sauber ein', (await centerOffset()) < 2);
}

console.log('\n═══ Tippen und Tastatur ═══');
await page.locator('[data-strip-item]').nth(30).click();
await page.waitForTimeout(800);
const tapped = await selected();
step('Tippen wählt den Eintrag', tapped !== keep, tapped);
step('Getippter Eintrag rückt in die Mitte', (await centerOffset()) < 2, `${(await centerOffset()).toFixed(1)} px`);

await page.locator('[data-strip-item][data-pressed]').focus();
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(700);
step('Pfeiltaste wählt direkt aus', (await selected()) !== tapped, await selected());

console.log('\n═══ Zeitraumwechsel ═══');
for (const [label, muster] of [['Jahr', /^\d{4}$/], ['Woche', /^KW /], ['Monat', / \d{4}$/]]) {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.waitForTimeout(900);
  const value = await selected();
  step(`${label}: Beschriftung passt`, muster.test(value), value);
  const off = await centerOffset();
  step(`${label}: Auswahl steht zentriert`, off < 2, `${off.toFixed(1)} px Abweichung`);
}

console.log('\n═══ Nur Zeiträume mit Daten ═══');
{
  const zaehle = async (pfad) => {
    await page.goto(BASE + pfad, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    return page.evaluate(() => {
      const it = [...document.querySelectorAll('[data-strip-item]')];
      return { n: it.length, erste: it[0]?.getAttribute('aria-label') };
    });
  };

  const uebersicht = await zaehle('/');
  const ausgaben = await zaehle('/ausgaben');

  step('Übersicht rechnet laufende Fixkosten mit',
    uebersicht.n > ausgaben.n, `${uebersicht.n} ab ${uebersicht.erste}`);
  step('Ausgabenliste zeigt nur selbst Erfasstes',
    ausgaben.n < uebersicht.n, `${ausgaben.n} ab ${ausgaben.erste}`);

  // Der eigentliche Beweis: hinter jeder wählbaren Pille der Ausgabenliste
  // müssen auch Einträge stehen.
  let leere = 0;
  let geprueft = 0;
  const anzahl = await page.evaluate(() => document.querySelectorAll('[data-strip-item]').length);
  for (let i = 0; i < anzahl; i++) {
    await page.locator('[data-strip-item]').nth(i).click();
    await page.waitForTimeout(450);
    const zeilen = await page.locator('.listRow').count();
    geprueft++;
    if (zeilen === 0) leere++;
  }
  step('Kein angebotener Zeitraum ist leer', leere === 0, `${geprueft} geprüft, ${leere} leer`);
}

await ctx.close();
await browser.close();

console.log('');
if (errors.length) {
  console.log('LAUFZEITFEHLER:');
  for (const e of [...new Set(errors)]) console.log('  ' + e);
}
console.log(failures === 0 ? 'Streifen in Ordnung.' : `${failures} Prüfung(en) fehlgeschlagen.`);
process.exit(failures === 0 && errors.length === 0 ? 0 : 1);
