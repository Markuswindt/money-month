/**
 * Waagerechter Overflow.
 *
 * Hintergrund: die .page-Container sind Grids. Eine implizite auto-Spalte
 * darf nicht unter die min-content-Breite ihres Inhalts schrumpfen - und
 * weil Listenzeilen ihren Text mit white-space: nowrap setzen, ist deren
 * min-content die VOLLE Textbreite. Eine lange Notiz hat dadurch die ganze
 * Seite verbreitert, statt per Ellipse abgeschnitten zu werden.
 *
 * Der Fehler haengt an den DATEN, nicht am Layout allein: mit kurzen
 * Demo-Notizen faellt er erst unter ~380px auf, mit laengeren schon bei
 * ~520px. Deshalb prueft dieses Skript zusaetzlich mit kuenstlich langem
 * Text - sonst wuerde es den Rueckfall erst bemerken, wenn jemand zufaellig
 * eine lange Notiz erfasst.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:4173';
const ROUTES = [
  ['Übersicht', '/'],
  ['Ausgaben', '/ausgaben'],
  ['Fixkosten', '/fixkosten'],
  ['Mehr', '/mehr'],
  ['Kategorien', '/mehr/kategorien'],
];
const WIDTHS = [320, 360, 390, 430, 520, 640, 800];
const LONG = 'Wocheneinkauf bei Edeka mit Getraenken Obst Gemuese und Haushaltswaren fuer die ganze Woche';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
const page = await ctx.newPage();
let failures = 0;

async function measure() {
  return page.evaluate(() => {
    const de = document.documentElement;
    return de.scrollWidth - de.clientWidth;
  });
}

for (const [name, route] of ROUTES) {
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 800 });
    await page.waitForTimeout(90);

    const plain = await measure();
    // Zweiter Durchgang mit kuenstlich langem Text in jeder Zeile.
    await page.evaluate((text) => {
      document.querySelectorAll('.listRow__meta, .listRow__title').forEach((el) => {
        el.textContent = text;
      });
    }, LONG);
    await page.waitForTimeout(90);
    const long = await measure();

    if (plain > 0 || long > 0) {
      failures++;
      console.log(` FEHL  ${name} @ ${width}px → Overflow ${plain}px (mit langem Text: ${long}px)`);
    } else {
      console.log(`  ok   ${name} @ ${width}px`);
    }
    // Text zuruecksetzen fuer die naechste Breite.
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(150);
  }
}

await browser.close();
console.log('');
console.log(failures === 0
  ? 'Kein waagerechter Overflow.'
  : `${failures} Fälle mit waagerechtem Overflow.`);
process.exit(failures === 0 ? 0 : 1);
