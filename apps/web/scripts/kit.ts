/**
 * Self-check for the design kit: screenshots /dev/kit on two phone sizes in English and Telugu,
 * and lists buttons under 48px and boxes whose text overflows. Needs only the web dev server.
 *   pnpm --filter @ecoproof/web kit
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
const out = fileURLToPath(new URL('../screens/', import.meta.url));
mkdirSync(out, { recursive: true });

const sizes = [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
];
let problems = 0;

const browser = await chromium.launch();
try {
  for (const size of sizes) {
    for (const lang of ['en', 'te']) {
      const context = await browser.newContext({ viewport: size, reducedMotion: 'reduce' });
      await context.addInitScript((l) => localStorage.setItem('ecoproof.lang', l), lang);
      const page = await context.newPage();
      await page.goto(`${WEB}/dev/kit`);
      await page.getByRole('heading', { level: 1 }).waitFor();
      await page.evaluate(() => document.fonts.ready);

      // No named helpers inside evaluate: tsx would inject a __name() call the page lacks.
      const issues = await page.evaluate(() => {
        const found: string[] = [];
        for (const b of document.querySelectorAll('button, a')) {
          const r = b.getBoundingClientRect();
          if (r.height > 0 && r.height < 48 && !b.hasAttribute('data-hit-area')) {
            found.push(
              `small target ${Math.round(r.height)}px: ${(b.textContent ?? '').trim().slice(0, 40)}`,
            );
          }
        }
        for (const el of document.querySelectorAll('main *')) {
          // .sr-only text is clipped on purpose.
          if (el.closest('.sr-only')) continue;
          if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible') {
            found.push(
              `overflow: <${el.tagName.toLowerCase()}> ${(el.textContent ?? '').trim().slice(0, 40)}`,
            );
          }
        }
        if (document.documentElement.scrollWidth > window.innerWidth) {
          found.push(`page scrolls sideways: ${document.documentElement.scrollWidth}px`);
        }
        return found;
      });
      for (const i of issues) console.log(`  ${size.width} ${lang}: ${i}`);
      problems += issues.length;

      const file = `${out}kit-${size.width}-${lang}.png`;
      await page.screenshot({ path: file, fullPage: true });
      console.log('saved', file);
      // KIT_SLICES=1 also saves screen-height slices, which are easier to read than one tall PNG.
      if (process.env.KIT_SLICES) {
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0, n = 0; y < height; y += size.height, n += 1) {
          await page.screenshot({
            path: `${out}kit-${size.width}-${lang}-part${n}.png`,
            fullPage: true,
            clip: { x: 0, y, width: size.width, height: Math.min(size.height, height - y) },
          });
        }
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}
console.log(problems ? `${problems} problem(s)` : 'no problems found');
