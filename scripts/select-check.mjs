import { chromium, devices } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 14 Pro'] });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', e => errors.push(e.message));
p.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
const step = (n, ok, d='') => console.log(`${ok?'  ok  ':' FEHL '} ${n}${d?'  → '+d:''}`);

await p.goto('http://localhost:4173/', { waitUntil:'networkidle' });
await p.waitForTimeout(700);
await p.getByRole('button', { name:'Ausgabe erfassen' }).click();
await p.waitForTimeout(400);
await p.getByRole('button', { name:'Fix', exact:true }).click();
await p.waitForTimeout(400);

// --- Maus: Wert wechseln -------------------------------------------------
await p.locator('#entry-interval').click();
await p.waitForTimeout(500);
step('Popup öffnet', await p.getByRole('option', { name:'Jährlich', exact:true }).isVisible());
await p.getByRole('option', { name:'Jährlich', exact:true }).click();
await p.waitForTimeout(500);
step('Auswahl übernommen', (await p.locator('#entry-interval').innerText()).includes('Jährlich'));

// Vorschau muss neu rechnen
await p.locator('#entry-amount').fill('');
await p.locator('#entry-amount').type('240', { delay: 25 });
await p.locator('#entry-amount').blur();
await p.waitForTimeout(500);
const vorschau = await p.getByText(/pro Monat/).first().innerText();
step('Vorschau rechnet mit neuem Intervall', /20,00/.test(vorschau), vorschau.slice(0,40));

// --- Wochentage erscheinen bei wöchentlich -------------------------------
await p.locator('#entry-interval').click();
await p.waitForTimeout(400);
await p.getByRole('option', { name:'Wöchentlich', exact:true }).click();
await p.waitForTimeout(500);
step('Label wechselt zu Wochentag', await p.getByText('Wochentag').isVisible());
await p.locator('#entry-dueday').click();
await p.waitForTimeout(400);
step('Wochentage ausgeschrieben', await p.getByRole('option', { name:'Mittwoch' }).isVisible());
await p.getByRole('option', { name:'Mittwoch' }).click();
await p.waitForTimeout(400);
step('Wochentag übernommen', (await p.locator('#entry-dueday').innerText()).includes('Mittwoch'));

// --- Tastatur ------------------------------------------------------------
await p.locator('#entry-interval').focus();
await p.keyboard.press('Enter');
await p.waitForTimeout(400);
const offen = await p.locator('.selectPopup[data-open]').isVisible();
await p.keyboard.press('ArrowDown');
await p.keyboard.press('Enter');
await p.waitForTimeout(400);
step('Mit Tastatur bedienbar', offen && (await p.locator('.selectPopup[data-open]').count()) === 0);

// Geschlossene Popups bleiben im DOM - sie duerfen weder sichtbar noch
// per Tastatur erreichbar sein, sonst sammelt das Sheet unsichtbare Ziele.
const geisterSichtbar = await p.evaluate(() =>
  [...document.querySelectorAll('.selectPopup:not([data-open])')]
    .filter(el => el.getBoundingClientRect().height > 0 &&
                  getComputedStyle(el).visibility !== 'hidden' &&
                  getComputedStyle(el).display !== 'none').length);
step('Geschlossene Popups unsichtbar', geisterSichtbar === 0, `sichtbare Geister: ${geisterSichtbar}`);

// --- 31 Einträge: springt die Liste zum gewählten Wert? ------------------
await p.locator('#entry-interval').click();
await p.waitForTimeout(300);
await p.getByRole('option', { name:'Monatlich', exact:true }).click();
await p.waitForTimeout(400);
await p.locator('#entry-dueday').click();
await p.waitForTimeout(300);
await p.getByRole('option', { name:'28.', exact:true }).click();
await p.waitForTimeout(400);
await p.locator('#entry-dueday').click();
await p.waitForTimeout(600);
const sichtbar = await p.getByRole('option', { name:'28.', exact:true }).isVisible();
const imBild = await p.evaluate(() => {
  const opts = [...document.querySelectorAll('.selectItem')];
  const sel = [...document.querySelectorAll('.selectPopup[data-open] .selectItem')].find(o => o.getAttribute('data-selected') !== null);
  if (!sel) return null;
  const list = sel.closest('.selectPopup').getBoundingClientRect();
  const r = sel.getBoundingClientRect();
  return r.top >= list.top - 1 && r.bottom <= list.bottom + 1;
});
step('Gewählter Wert (28.) im sichtbaren Bereich', sichtbar && imBild === true,
     imBild === null ? 'kein data-selected gefunden' : '');

await p.keyboard.press('Escape');
await p.waitForTimeout(300);

// --- Trefferflächen im Popup --------------------------------------------
await p.locator('#entry-dueday').click();
await p.waitForTimeout(500);
const klein = await p.evaluate(() =>
  [...document.querySelectorAll('.selectPopup[data-open] .selectItem')]
    .map(e => Math.round(e.getBoundingClientRect().height))
    .filter(h => h > 0 && h < 44));
step('Alle Einträge mindestens 44 px hoch', klein.length === 0, klein.length ? `zu klein: ${klein.join(',')}` : '');

await b.close();
console.log('');
console.log(errors.length ? 'LAUFZEITFEHLER:\n  ' + [...new Set(errors)].join('\n  ') : 'Keine Laufzeitfehler.');
