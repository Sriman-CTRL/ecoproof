/**
 * Self-check: walks Demo A on a 390x844 phone and saves a PNG of each screen.
 * Needs the API (DOCUMENT_READER=fake) and the web dev server running.
 *   pnpm --filter @ecoproof/web screens
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
const out = fileURLToPath(new URL('../screens/', import.meta.url));
const bill = fileURLToPath(
  new URL('../../api/prisma/demo/bills/bill-2026-10-photo.png', import.meta.url),
);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
let n = 0;
const shot = async (name: string) => {
  n += 1;
  await page.screenshot({
    path: `${out}${String(n).padStart(2, '0')}-${name}.png`,
    fullPage: true,
  });
  console.log('saved', name);
};

try {
  await page.goto(`${WEB}/start`);
  await page.getByText('Sri Lakshmi Castings: before').waitFor();
  await shot('start');

  await page.getByText('Sri Lakshmi Castings: before').click();
  await page.waitForURL(/\/(consent|home)$/);
  if (page.url().endsWith('/consent')) {
    await shot('consent');
    await page.getByRole('button', { name: 'I agree' }).click();
    await page.waitForURL(/\/home$/);
  }
  await page.getByText('Your months').waitFor();
  await shot('home');

  await page.getByRole('button', { name: /Add a bill/ }).click();
  await page.waitForURL(/\/bills\/new$/);
  await shot('add-bill');

  await page.getByTestId('bill-file').setInputFiles(bill);
  await page.getByText('Reading your bill...').waitFor();
  await shot('reading');

  await page.waitForURL(/\/confirm$/, { timeout: 90_000 });
  await page.getByText('Check your bill').waitFor();
  await shot('confirm');

  for (const box of await page.getByRole('checkbox').all()) await box.check();
  await page.getByLabel(/Tonnes of good castings/).fill('100');
  await page.getByLabel(/Diesel used/).fill('1200');
  await page.getByRole('button', { name: 'Confirm all' }).click();
  await page.waitForURL(/\/results\//, { timeout: 30_000 });
  await page.getByText('Bill health check', { exact: true }).waitFor();
  await page.getByText('Why this number?').click();
  await page.getByText('Formula version').waitFor();
  await shot('result');

  await page.getByRole('button', { name: 'See bill health' }).click();
  await page.waitForURL(/\/health/);
  await page.getByText('Low power factor').waitFor();
  await page.getByLabel(/Units you could move/).fill('1000');
  await page.getByText('Why?').first().click();
  await shot('health');

  await page.getByRole('button', { name: 'See your action plan' }).click();
  await page.waitForURL(/\/actions/);
  await page.getByText('Your action plan').waitFor();
  await page.getByText(/See all \(/).click();
  await page.getByText('Fix power factor (capacitor bank)').waitFor();
  await shot('actions');

  await page.getByText('Fix power factor (capacitor bank)').click();
  await page.waitForURL(/\/actions\/fix_power_factor/);
  await page.getByLabel(/Loan amount/).fill('10,00,000');
  await page.getByText('Cash-positive from month 1').waitFor();
  await page.getByTestId('emi-panel').getByText('₹20,276').waitFor();
  await shot('action-detail');

  await page
    .getByRole('link', { name: /EcoProof|Sri Lakshmi/ })
    .first()
    .click();
  await page.getByText('Your next action').waitFor();
  await shot('home-after');
} finally {
  await browser.close();
}
