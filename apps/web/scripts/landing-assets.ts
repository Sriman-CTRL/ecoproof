/**
 * Builds the landing page images in apps/web/public/landing/ (committed; sample data only).
 * Walks Demo A on a 390px phone (add bill -> confirm -> bill health), takes screenshots and the
 * clean sample bill, stamps a visible "SAMPLE DATA" watermark and writes WebP width variants.
 * Needs the API (DOCUMENT_READER=fake) and the web dev server running. Reset the demo afterwards.
 *   pnpm --filter @ecoproof/web exec tsx scripts/landing-assets.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
const out = fileURLToPath(new URL('../public/landing/', import.meta.url));
const bill = fileURLToPath(
  new URL('../../api/prisma/demo/bills/bill-2026-10-clean.png', import.meta.url),
);
const billPhoto = fileURLToPath(
  new URL('../../api/prisma/demo/bills/bill-2026-10-photo.png', import.meta.url),
);
mkdirSync(out, { recursive: true });

const watermark = (w: number, h: number) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><text x="50%" y="50%" text-anchor="middle" transform="rotate(-24 ${w / 2} ${h / 2})" font-family="sans-serif" font-weight="700" font-size="${Math.round(w / 9)}" fill="#b45309" fill-opacity="0.22">SAMPLE DATA</text></svg>`,
  );

/** Writes name-<width>.webp for each width, lowering quality until the file fits maxKb. */
async function variants(
  src: Buffer,
  name: string,
  widths: number[],
  opts: { maxKb: number; mark: boolean },
) {
  for (const width of widths) {
    const base = await sharp(src).resize({ width }).toBuffer();
    const meta = await sharp(base).metadata();
    const img = opts.mark
      ? await sharp(base)
          .composite([{ input: watermark(meta.width!, meta.height!) }])
          .toBuffer()
      : base;
    let q = 80;
    let buf = await sharp(img).webp({ quality: q, effort: 6 }).toBuffer();
    while (buf.length > opts.maxKb * 1024 && q > 30) {
      q -= 5;
      buf = await sharp(img).webp({ quality: q, effort: 6 }).toBuffer();
    }
    writeFileSync(`${out}${name}-${width}.webp`, buf);
    console.log(
      `${name}-${width}.webp ${meta.width}x${meta.height} q${q} ${(buf.length / 1024).toFixed(1)} KB`,
    );
  }
}

const browser = await chromium.launch();
try {
  // The clean bill, cropped to the table (the lower half of the page is empty). No extra mark:
  // the bill already carries "SAMPLE - SYNTHETIC - NOT A REAL BILL".
  const clean = await sharp(readFileSync(bill))
    .extract({ left: 0, top: 0, width: 1588, height: 1480 })
    .toBuffer();
  await variants(clean, 'bill', [480, 800, 1200], { maxKb: 90, mark: false });

  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(`${WEB}/start`);
  await page.getByText('Sri Lakshmi Castings: before').click();
  await page.waitForURL(/\/(consent|home)$/);
  if (page.url().endsWith('/consent')) {
    await page.getByRole('button', { name: 'I agree' }).click();
    await page.waitForURL(/\/home$/);
  }
  await page.getByText('Latest bills').waitFor();

  await page.goto(`${WEB}/bills/new`);
  await page.getByText('Take photo of bill').first().waitFor();
  await variants(
    await page.screenshot({ clip: { x: 0, y: 56, width: 390, height: 420 } }),
    'step-add',
    [390],
    {
      maxKb: 30,
      mark: true,
    },
  );

  await page.getByTestId('bill-file').setInputFiles(billPhoto);
  await page.waitForURL(/\/confirm$/, { timeout: 90_000 });
  await page.getByText('Check your bill').waitFor();
  await variants(
    await page.screenshot({ clip: { x: 0, y: 56, width: 390, height: 420 } }),
    'step-check',
    [390],
    {
      maxKb: 30,
      mark: true,
    },
  );

  for (const box of await page.getByRole('checkbox').all()) await box.check();
  await page.getByLabel(/Tonnes of good castings/).fill('100');
  await page.getByLabel(/Diesel used/).fill('1200');
  await page.getByRole('button', { name: 'Confirm all' }).click();
  await page.waitForURL(/\/results\//, { timeout: 30_000 });
  await page.goto(`${WEB}/health`);
  await page.getByText('Low power factor').waitFor();
  await page.waitForFunction(() => !document.querySelector('[aria-busy=true]'));
  await page.waitForTimeout(900); // count-up
  await variants(await page.screenshot(), 'hero-health', [390, 780], { maxKb: 78, mark: true });
  await variants(
    await page.screenshot({ clip: { x: 0, y: 56, width: 390, height: 210 } }),
    'step-see',
    [390],
    {
      maxKb: 30,
      mark: true,
    },
  );
  await ctx.close();
} finally {
  await browser.close();
}
