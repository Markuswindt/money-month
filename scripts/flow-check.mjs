import { chromium, devices } from 'playwright';

const BASE = 'http://localhost:4173';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 14 Pro'], colorScheme: 'light' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const step = (n, ok, detail = '') =>
  console.log(`${ok ? '  ok  ' : ' FEHL '} ${n}${detail ? '  → ' + detail : ''}`);

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// Ausgangswert der Gesamtsumme merken
const heroBefore = (await page.locator('main').getByText(/€/).first().innerText()).trim();
step('App geladen', heroBefore.includes('€'), `Summe ${heroBefore}`);

// --- Erfassen -------------------------------------------------------------
await page.getByRole('button', { name: 'Ausgabe erfassen' }).click();
await page.waitForTimeout(500);
step('Sheet offen', await page.getByText('Neue Ausgabe').isVisible());

// Betrag tippen - deutsche Schreibweise mit Komma
await page.locator('#entry-amount').fill('');
await page.locator('#entry-amount').type('42,50', { delay: 30 });
await page.locator('#entry-amount').blur();
await page.waitForTimeout(300);
const shown = await page.locator('#entry-amount').inputValue();
step('Betrag als 42,50 € formatiert', shown.replace(/ | /g, ' ').includes('42,50'), shown);

// Kategorie waehlen
await page.getByRole('radio', { name: /Lebensmittel/ }).click();
step('Kategorie gewählt', await page.getByRole('radio', { name: /Lebensmittel/ }).getAttribute('aria-checked') === 'true');

// Notiz
await page.getByRole('button', { name: '+ Notiz hinzufügen' }).click();
await page.locator('#entry-note').fill('Playwright-Test');

await page.getByRole('button', { name: 'Speichern', exact: true }).click();
await page.waitForTimeout(900);
step('Sheet geschlossen', !(await page.getByText('Neue Ausgabe').isVisible().catch(() => false)));

// --- Auftauchen in der Liste ---------------------------------------------
await page.getByRole('link', { name: 'Ausgaben' }).click();
await page.waitForTimeout(600);
const inList = await page.getByText('Playwright-Test').first().isVisible().catch(() => false);
step('Ausgabe steht in der Liste', inList);

const heuteSichtbar = await page.getByText('Heute', { exact: true }).first().isVisible().catch(() => false);
step('Unter "Heute" gruppiert', heuteSichtbar);

// --- Bearbeiten und Loeschen mit Rueckgaengig ------------------------------
await page.getByText('Playwright-Test').first().click();
await page.waitForTimeout(500);
step('Bearbeiten geöffnet', await page.getByText('Ausgabe bearbeiten').isVisible());

await page.getByRole('button', { name: 'Löschen' }).click();
await page.waitForTimeout(700);
const undoDa = await page.getByRole('button', { name: 'Rückgängig' }).isVisible().catch(() => false);
step('Undo-Meldung erschienen', undoDa);

const wegNachLoeschen = !(await page.getByText('Playwright-Test').first().isVisible().catch(() => false));
step('Eintrag verschwunden', wegNachLoeschen);

if (undoDa) {
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await page.waitForTimeout(700);
  const zurueck = await page.getByText('Playwright-Test').first().isVisible().catch(() => false);
  step('Rückgängig stellt wieder her', zurueck);
}

// --- Persistenz ueber Neuladen -------------------------------------------
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.getByRole('link', { name: 'Ausgaben' }).click();
await page.waitForTimeout(700);
const nachReload = await page.getByText('Playwright-Test').first().isVisible().catch(() => false);
step('Überlebt Neuladen (IndexedDB)', nachReload);

// --- Perioden umschalten --------------------------------------------------
await page.getByRole('link', { name: 'Übersicht' }).click();
await page.waitForTimeout(400);
for (const p of ['Woche', 'Jahr', 'Monat']) {
  await page.getByRole('button', { name: p, exact: true }).click();
  await page.waitForTimeout(350);
  const ok = await page.locator('main').getByText(/€/).first().isVisible();
  step(`Zeitraum ${p}`, ok);
}

// --- Fixkosten anlegen ----------------------------------------------------
await page.getByRole('button', { name: 'Ausgabe erfassen' }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Fix', exact: true }).click();
await page.waitForTimeout(300);
await page.locator('#entry-amount').fill('');
await page.locator('#entry-amount').type('240', { delay: 30 });
await page.locator('#entry-amount').blur();
// Kein natives <select> mehr - der Ausloeser ist ein Button mit
// role="combobox", die Auswahl laeuft ueber die Optionsliste.
await page.locator('#entry-interval').click();
await page.waitForTimeout(400);
await page.getByRole('option', { name: 'Jährlich', exact: true }).click();
await page.waitForTimeout(400);
const vorschau = await page.locator('main, [role=dialog]').getByText(/pro Monat/).first().innerText().catch(() => '');
step('Fixkosten-Vorschau rechnet', /20,00/.test(vorschau), vorschau.trim().slice(0, 70));

await ctx.close();
await browser.close();

console.log('');
if (errors.length) { console.log('LAUFZEITFEHLER:'); for (const e of [...new Set(errors)]) console.log('  ' + e); }
else console.log('Keine Laufzeitfehler.');
