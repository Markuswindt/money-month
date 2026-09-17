import { chromium, devices } from 'playwright';

const BASE = 'http://localhost:4173';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 14 Pro'] });
const page = await ctx.newPage();
const step = (n, ok, d = '') => console.log(`${ok ? '  ok  ' : ' FEHL '} ${n}${d ? '  → ' + d : ''}`);

await page.goto(BASE, { waitUntil: 'networkidle' });

// Service Worker registrieren lassen und auf "activated" warten
const swState = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return 'nicht unterstützt';
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  return reg?.active?.state ?? 'keine Registrierung';
});
step('Service Worker aktiv', swState === 'activated', swState);

// Precache-Inhalt pruefen
const cached = await page.evaluate(async () => {
  const names = await caches.keys();
  let total = 0;
  const per = [];
  for (const n of names) {
    const keys = await (await caches.open(n)).keys();
    total += keys.length;
    per.push(`${n}: ${keys.length}`);
  }
  return { total, per };
});
step('Dateien im Cache', cached.total > 5, cached.per.join(', '));

// Manifest erreichbar und korrekt
const manifest = await page.evaluate(async () => {
  const r = await fetch('/manifest.webmanifest');
  return r.ok ? await r.json() : null;
});
step('Manifest gültig', manifest?.name === 'Money>Month',
  manifest ? `${manifest.name}, display=${manifest.display}, ${manifest.icons.length} Icons` : 'fehlt');

// Eine Ausgabe erfassen, damit es etwas zu sehen gibt
await page.waitForTimeout(600);

// --- JETZT OFFLINE --------------------------------------------------------
await ctx.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

const titel = await page.title();
step('Seite lädt offline', titel.includes('Money'), `Titel: ${titel}`);

const summeDa = await page.locator('main').getByText(/€/).first().isVisible().catch(() => false);
step('Daten offline sichtbar', summeDa);

// Offline erfassen
await page.getByRole('button', { name: 'Ausgabe erfassen' }).click();
await page.waitForTimeout(500);
await page.locator('#entry-amount').fill('');
await page.locator('#entry-amount').type('9,99', { delay: 20 });
await page.locator('#entry-amount').blur();
await page.getByRole('button', { name: 'Speichern', exact: true }).click();
await page.waitForTimeout(800);
step('Offline erfassen möglich', !(await page.getByText('Neue Ausgabe').isVisible().catch(() => false)));

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
const nochDa = await page.locator('main').getByText(/9,99/).first().isVisible().catch(() => false);
step('Offline gespeicherte Daten überleben Reload', nochDa);

await browser.close();
