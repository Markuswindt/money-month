import { chromium, devices } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const OUT = '/tmp/mm-shots';

const errors = [];
const browser = await chromium.launch();

async function shoot(ctxOpts, name, steps) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${name}] console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${name}] pageerror: ${e.message}`));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  if (steps) await steps(page);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  await ctx.close();
}

const iphone = { ...devices['iPhone 14 Pro'] };

// 1. Uebersicht, hell
await shoot({ ...iphone, colorScheme: 'light' }, '01-uebersicht-hell');
// 2. Uebersicht, dunkel
await shoot({ ...iphone, colorScheme: 'dark' }, '02-uebersicht-dunkel');
// 3. Erfassungs-Sheet
await shoot({ ...iphone, colorScheme: 'light' }, '03-erfassen', async (p) => {
  await p.getByRole('button', { name: 'Ausgabe erfassen' }).click();
  await p.waitForTimeout(700);
});
// 4. Fixkosten
await shoot({ ...iphone, colorScheme: 'light' }, '04-fixkosten', async (p) => {
  await p.getByRole('link', { name: 'Fixkosten' }).click();
  await p.waitForTimeout(500);
});
// 5. Ausgabenliste
await shoot({ ...iphone, colorScheme: 'dark' }, '05-ausgaben', async (p) => {
  await p.getByRole('link', { name: 'Ausgaben' }).click();
  await p.waitForTimeout(500);
});
// 6. Kategorie-Detail
await shoot({ ...iphone, colorScheme: 'light' }, '06-kategorie', async (p) => {
  await p.locator('button').filter({ hasText: 'Wohnen' }).first().click();
  await p.waitForTimeout(600);
});
// 7. Einstellungen
await shoot({ ...iphone, colorScheme: 'light' }, '07-mehr', async (p) => {
  await p.getByRole('link', { name: 'Mehr' }).click();
  await p.waitForTimeout(400);
});
// 8. Desktop
await shoot({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' }, '08-desktop');
// 9. Desktop dunkel
await shoot({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' }, '09-desktop-dunkel');

await browser.close();

if (errors.length) {
  console.log('FEHLER:');
  for (const e of [...new Set(errors)]) console.log('  ' + e);
} else {
  console.log('Keine Konsolen- oder Laufzeitfehler.');
}
