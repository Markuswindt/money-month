import { chromium, devices } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const BASE = 'http://localhost:4173';
const browser = await chromium.launch();

const ROUTES = [
  ['Übersicht', '/'],
  ['Ausgaben', '/ausgaben'],
  ['Fixkosten', '/fixkosten'],
  ['Mehr', '/mehr'],
  ['Kategorien', '/mehr/kategorien'],
];

let totalViolations = 0;

for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ ...devices['iPhone 14 Pro'], colorScheme: scheme });
  const page = await ctx.newPage();
  console.log(`\n═══ ${scheme === 'light' ? 'HELL' : 'DUNKEL'} ═══`);
  for (const [name, path] of ROUTES) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    const res = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    totalViolations += res.violations.length;
    if (res.violations.length === 0) {
      console.log(`  ok    ${name}`);
    } else {
      console.log(`  FEHL  ${name}`);
      for (const v of res.violations) {
        console.log(`          [${v.impact}] ${v.id}: ${v.help}`);
        for (const n of v.nodes.slice(0, 2)) console.log(`            ${n.html.slice(0, 110)}`);
      }
    }
  }
  await ctx.close();
}

// Trefferflaechen pruefen
const ctx = await browser.newContext({ ...devices['iPhone 14 Pro'] });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const small = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('button, a, input, select, [role=radio]')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
        if (r.height < 44) {
      out.push(`${el.tagName.toLowerCase()}.${el.className.toString().slice(0, 30)} ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
  }
  return [...new Set(out)];
});
console.log(`\n═══ Trefferflächen unter 44 px ═══`);
console.log(small.length ? small.map((s) => '  ' + s).join('\n') : '  keine');

await browser.close();
console.log(`\nVerstöße gesamt: ${totalViolations}`);
