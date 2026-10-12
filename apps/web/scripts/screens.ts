/**
 * Self-check: walks Demo A on a 390x844 phone and saves a PNG of each screen.
 * Needs the API (DOCUMENT_READER=fake) and the web dev server running.
 *   pnpm --filter @ecoproof/web screens
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
  // Card total = sum of this bill's flagged findings (PF 60,000 + demand 40,000).
  await page.getByTestId('at-stake').getByText('₹1,00,000').waitFor();
  await page.getByText('+ peak saving once you enter units').waitFor();
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

  // Loan-ready summary: plan -> quote -> make -> report -> share -> share link -> verify.
  await page.getByRole('button', { name: 'Plan this action' }).click();
  await page.getByLabel('Vendor name').fill('Sample Capacitors (synthetic)');
  await page.getByLabel(/Quote amount/).fill('2,50,000');
  await page.getByRole('button', { name: 'Make loan-ready summary' }).click();
  await page.waitForURL(/\/reports\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  await page.getByText('Document seal').waitFor();
  const reportId = page.url().split('/reports/')[1]!;
  await shot('report');

  const pdfUrl = await page.getByRole('link', { name: 'Download PDF' }).getAttribute('href');
  const pdf = Buffer.from(await (await page.request.get(pdfUrl!)).body());
  const pdfPath = `${out}loan-pack.pdf`;
  const tamperedPath = `${out}loan-pack-tampered.pdf`;
  writeFileSync(pdfPath, pdf);
  const tampered = Buffer.from(readFileSync(pdfPath));
  const at = Math.floor(tampered.length / 2);
  tampered[at] = tampered[at]! ^ 0xff;
  writeFileSync(tamperedPath, tampered);
  console.log('report', reportId, 'pdf bytes', pdf.length);

  await page.getByLabel('Recipient name').fill('Sample Bank (synthetic)');
  await page.getByRole('button', { name: 'Make share link' }).click();
  const shareUrl = (await page.getByTestId('share-url').textContent())!.trim();
  await page.getByText('Views: 0 · Downloads: 0').waitFor();
  await shot('share');

  await page.goto(shareUrl);
  await page.getByText('Shared loan-ready summary').waitFor();
  await page.getByRole('button', { name: 'Download PDF' }).waitFor();
  await shot('share-link');

  await page.goto(`${WEB}/verify/${reportId}`);
  await page.getByText('Check a PDF').waitFor();
  await page.getByTestId('verify-file').setInputFiles(pdfPath);
  await page.getByText('Matches: this is the original document').waitFor();
  await shot('verify-match');
  await page.getByTestId('verify-file').setInputFiles(tamperedPath);
  await page.getByText('Does not match: this file was changed or is a different version').waitFor();
  await shot('verify-mismatch');

  await page.goto(`${WEB}/reports/${reportId}`);
  await page.getByText('Views: 1 · Downloads: 0').waitFor();

  await page
    .getByRole('link', { name: /EcoProof|Sri Lakshmi/ })
    .first()
    .click();
  await page.getByText('Your next action').waitFor();
  await shot('home-after');
} finally {
  await browser.close();
}
