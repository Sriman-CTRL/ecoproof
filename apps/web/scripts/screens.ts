/**
 * Self-check: walks Demo A on a 390x844 phone in English, then re-visits four screens at 360x800
 * in Telugu, and saves a PNG of each screen. Also reports horizontal overflow, tap targets under
 * 48px and anything hidden behind the tab bar.
 * Needs the API (DOCUMENT_READER=fake) and the web dev server running. Reset the demo afterwards.
 *   pnpm --filter @ecoproof/web screens
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';

const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
const out = fileURLToPath(new URL('../screens/', import.meta.url));
const bill = fileURLToPath(
  new URL('../../api/prisma/demo/bills/bill-2026-10-photo.png', import.meta.url),
);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
let n = 0;
const problems: string[] = [];

/** Layout checks that a PNG alone makes easy to miss. */
async function audit(page: Page, name: string) {
  const found = await page.evaluate(() => {
    const issues: string[] = [];
    const root = document.documentElement;
    if (root.scrollWidth > root.clientWidth + 1) issues.push('horizontal overflow');
    const interactive = [
      ...document.querySelectorAll<HTMLElement>('a[href], button, label:has(input[type=file])'),
    ].filter((el) => el.offsetParent !== null && !el.closest('[aria-hidden=true]'));
    for (const el of interactive) {
      const r = el.getBoundingClientRect();
      const label = (el.textContent ?? '').trim().slice(0, 30) || el.getAttribute('aria-label');
      // Inline chips get a 48px overlay (data-hit-area); everything else must be tall enough.
      if (r.height < 47 && !el.dataset.hitArea && r.width > 0)
        issues.push(`short target: ${label}`);
    }
    // Scrolled to the end, the last content must sit above the sticky bar and the tab bar.
    window.scrollTo(0, root.scrollHeight);
    const bars = [...document.querySelectorAll('nav, div.sticky')]
      .filter((e) => !e.closest('main'))
      .map((e) => e.getBoundingClientRect().top);
    const main = document.querySelector('main')?.getBoundingClientRect().bottom ?? 0;
    if (bars.length && main > Math.min(...bars) + 1) issues.push('content hidden under the bars');
    window.scrollTo(0, 0);
    const primary = [...document.querySelectorAll<HTMLElement>('.bg-green-700')].filter(
      (el) =>
        el.offsetParent !== null &&
        el.getBoundingClientRect().width > 200 &&
        el.getBoundingClientRect().height >= 48,
    );
    if (primary.length > 1) issues.push(`${primary.length} primary buttons`);
    return issues;
  });
  for (const i of found) problems.push(`${name}: ${i}`);
}

/** Full-height viewport so the sticky bars land at the bottom, as they do at the end of a scroll. */
async function shot(page: Page, name: string, sheetOpen = false) {
  n += 1;
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  // Skeletons mean data is still loading: a shot of them proves nothing.
  await page.waitForFunction(() => !document.querySelector('[aria-busy=true]'), undefined, {
    timeout: 15_000,
  });
  await audit(page, name);
  const path = `${out}${String(n).padStart(2, '0')}-${name}.png`;
  if (sheetOpen) {
    await page.screenshot({ path });
  } else {
    const vp = page.viewportSize()!;
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: vp.width, height: Math.max(h, vp.height) });
    await page.screenshot({ path });
    await page.setViewportSize(vp);
  }
  console.log('saved', name);
}

let reportId = '';
const pdfPath = `${out}loan-pack.pdf`;
const tamperedPath = `${out}loan-pack-tampered.pdf`;

/** Scrolls through the page so lazy images load before the full-height shot. */
async function loadLazy(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
}

try {
  // ---------- Landing page "/": 390x844 EN, 1280x800 EN, 360x800 TE ----------
  for (const [w, h, lang, name] of [
    [390, 844, 'en', 'landing-390'],
    [1280, 800, 'en', 'landing-1280'],
    [360, 800, 'te', 'landing-te-360'],
  ] as const) {
    const lp = await browser.newPage({ viewport: { width: w, height: h } });
    await lp.addInitScript((l) => localStorage.setItem('ecoproof.lang', l), lang);
    await lp.goto(`${WEB}/`);
    await lp.locator('#how').waitFor();
    await loadLazy(lp);
    await lp.getByTestId('money').waitFor();
    await lp.locator('[role=img] svg').waitFor();
    await shot(lp, name);
    await lp.close();
  }

  // The landing QR target: the seeded sample report must verify (not 404) after a demo reset.
  const demoReportId = process.env.VITE_DEMO_REPORT_ID ?? '5d3a0a10-0000-4000-8000-0000000000c1';
  const vp = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await vp.goto(`${WEB}/verify/${demoReportId}`);
  await vp.getByText('This document is genuine').waitFor();
  await shot(vp, 'verify-demo-report');
  await vp.close();

  // ---------- English, 390x844 ----------
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${WEB}/start`);
  await page.getByText('Sri Lakshmi Castings: before').waitFor();
  await page.getByText(/Sept? 2026 bill: a month at stake/).waitFor();
  await shot(page, 'start');

  await page.getByText('Sri Lakshmi Castings: before').click();
  await page.waitForURL(/\/(consent|home)$/);
  if (page.url().endsWith('/consent')) {
    await page.getByText('Your data is shared with nobody until you share it').waitFor();
    await shot(page, 'consent');
    await page.getByRole('button', { name: 'I agree' }).click();
    await page.waitForURL(/\/home$/);
  }
  await page.getByText('Latest bills').waitFor();
  await page.getByText('At stake every month, found in your bill').waitFor();
  // D4a: path (Baseline set), headroom (nothing started yet), monthly ritual.
  await page.getByTestId('progress-path').getByText('You are here: Baseline set').waitFor();
  await page.getByText("You've started fixes worth ₹0.").waitFor();
  await page.getByTestId('ritual').waitFor();
  await shot(page, 'home');

  // S8b: Home's money found line -> /schemes (ZED card first).
  await page.getByTestId('money-found-line').getByText('Money found for you: ₹10,000').waitFor();
  await page.getByTestId('money-found-line').click();
  await page.waitForURL(/\/schemes$/);
  await page.getByTestId('zed-card').waitFor();
  await page.getByTestId('money-found').waitFor();
  await shot(page, 'schemes');
  await page.goBack();
  await page.getByTestId('progress-path').waitFor();

  await page.getByTestId('progress-path').click();
  await page.waitForURL(/\/progress$/);
  await page.getByTestId('stage-2').getByText('Reached').waitFor();
  await page.getByTestId('cluster-note').waitFor();
  await shot(page, 'progress-a');
  await page.goBack();
  await page.waitForURL(/\/home$/);

  await page.getByRole('navigation').getByRole('link', { name: 'Bills' }).click();
  await page.waitForURL(/\/bills$/);
  await page.getByText('Your bills').waitFor();
  await page.getByRole('table').waitFor();
  await shot(page, 'bills');

  await page.getByRole('link', { name: 'Add a bill' }).click();
  await page.waitForURL(/\/bills\/new$/);
  await page.getByText('Take photo of bill').first().waitFor();
  await shot(page, 'add-bill');

  await page.getByTestId('bill-file').setInputFiles(bill);
  await page.getByText('Reading your bill...').waitFor();
  await shot(page, 'reading');

  await page.waitForURL(/\/confirm$/, { timeout: 90_000 });
  await page.getByText('Check your bill').waitFor();
  await shot(page, 'confirm');

  for (const box of await page.getByRole('checkbox').all()) await box.check();
  await page.getByLabel(/Tonnes of good castings/).fill('100');
  await page.getByLabel(/Diesel used/).fill('1200');
  await page.getByRole('button', { name: 'Confirm all' }).click();
  await page.waitForURL(/\/results\//, { timeout: 30_000 });
  await page.getByText('Bill health check', { exact: true }).waitFor();
  // Card total = sum of this bill's flagged findings (PF 60,000 + demand 40,000).
  await page.getByTestId('at-stake').getByText('₹1,00,000').waitFor();
  await page.getByText('+ peak saving once you enter units').waitFor();
  await shot(page, 'result');
  await page.getByRole('button', { name: 'Why this number?' }).click();
  await page.getByText('Formula version').waitFor();
  await shot(page, 'result-why', true);
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'See bill health' }).click();
  await page.waitForURL(/\/health/);
  await page.getByText('Low power factor').waitFor();
  await page.getByLabel(/Units you could move/).fill('1000');
  await page.getByText('Low cost, quote needed').waitFor();
  await page.getByTestId('finding-peak_use').getByText(/₹\d/).first().waitFor();
  await page.getByRole('button', { name: 'Why?' }).first().click();
  await shot(page, 'health-why', true);
  await page.getByRole('button', { name: 'Close' }).click();
  // Explainer line: this bill's own numbers (1,00,000 kVAh vs 92,000 kWh on the Oct sample).
  await page.getByRole('button', { name: 'What is power factor?' }).click();
  await page
    .getByTestId('explainer')
    .getByText(/Your bill shows .* kVAh/)
    .waitFor();
  await shot(page, 'health');

  // Primary button: straight to the API's #1 action (zero-cost first, Doc 02/03 order).
  await page.getByRole('button', { name: 'Start the top fix' }).click();
  await page.waitForURL(/\/actions\/reduce_contracted_demand/);
  await page.getByRole('navigation').getByRole('link', { name: 'Plan' }).click();
  await page.waitForURL(/\/actions$/);
  await page.getByText('Your action plan').waitFor();
  await page.getByText('Not started').first().waitFor();
  await shot(page, 'actions');
  await page.getByText(/See all \(/).click();
  await page.getByText('Fix power factor (capacitor bank)').waitFor();

  await page.getByText('Fix power factor (capacitor bank)').click();
  await page.waitForURL(/\/actions\/fix_power_factor/);
  await page.getByLabel(/Loan amount/).fill('10,00,000');
  await page.getByText('Cash-positive from month 1').waitFor();
  // The saving must be this month's API value, never a stale cached one.
  await page.getByText('₹60,000').first().waitFor();
  await page.getByTestId('emi-panel').getByText('₹20,276').waitFor();
  await shot(page, 'action-detail');

  // Loan-ready summary: plan -> quote -> make -> report -> share -> share link -> verify.
  await page.getByRole('button', { name: 'Plan this action' }).click();
  await page.getByLabel('Vendor name').fill('Sample Capacitors (synthetic)');
  await page.getByLabel(/Quote amount/).fill('2,50,000');
  await page.getByRole('button', { name: 'Make loan-ready summary' }).click();
  await page.waitForURL(/\/reports\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  await page.getByText('Document seal').waitFor();
  reportId = page.url().split('/reports/')[1]!;
  await shot(page, 'report');

  const pdfUrl = await page.getByRole('link', { name: 'Download PDF' }).getAttribute('href');
  const pdf = Buffer.from(await (await page.request.get(pdfUrl!)).body());
  writeFileSync(pdfPath, pdf);
  const tampered = Buffer.from(readFileSync(pdfPath));
  const at = Math.floor(tampered.length / 2);
  tampered[at] = tampered[at]! ^ 0xff;
  writeFileSync(tamperedPath, tampered);
  console.log('report', reportId, 'pdf bytes', pdf.length);

  await page.getByLabel('Recipient name').fill('Sample Bank (synthetic)');
  await page.getByRole('button', { name: 'Share with a lender' }).click();
  const shareUrl = (await page.getByTestId('share-url').textContent())!.trim();
  await page.getByText('Views: 0 · Downloads: 0').waitFor();
  await shot(page, 'share');

  await page.goto(shareUrl);
  await page.getByText('This document is genuine').waitFor();
  await page.getByRole('button', { name: 'Download PDF' }).waitFor();
  await shot(page, 'share-link');

  await page.goto(`${WEB}/verify/${reportId}`);
  await page.getByText('This document is genuine').waitFor();
  await page
    .getByRole('button', { name: 'Check a PDF file' })
    .waitFor()
    .catch(() => undefined);
  await shot(page, 'verify');
  await page.getByTestId('verify-file').setInputFiles(pdfPath);
  await page.getByText('Your file is the same as the original.').waitFor();
  await shot(page, 'verify-match');
  await page.getByTestId('verify-file').setInputFiles(tamperedPath);
  await page.getByText('This file does not match', { exact: true }).waitFor();
  await shot(page, 'verify-mismatch');

  await page.goto(`${WEB}/reports/${reportId}`);
  await page.getByText('Views: 1 · Downloads: 0').waitFor();

  await page.getByRole('link', { name: 'EcoProof' }).first().click();
  await page.getByText('Latest bills').waitFor();
  // Oct confirmed and the PF fix planned: the headroom moved.
  await page.getByText("You've started fixes worth ₹60,000.").waitFor();
  await shot(page, 'home-after');

  // Demo A has a baseline but no done action: /savings shows its empty state with the reason.
  await page.goto(`${WEB}/savings`);
  await page.getByText('No savings to show yet').waitFor();
  await shot(page, 'savings-empty');

  // S8b: /reports -> CBAM sheet flow. 7325 shows the scope warning; 7307 11 (100 t) is generated.
  await page.goto(`${WEB}/reports`);
  await page.getByTestId('cbam-create').waitFor();
  await page.getByTestId('report-row').first().waitFor();
  await shot(page, 'reports-a');
  await page.getByTestId('cbam-create').click();
  await page.waitForURL(/\/reports\/cbam\/new$/);
  await page.getByTestId('cn-search').fill('7325');
  await page.getByRole('button', { name: /^7325/ }).click();
  await page.getByTestId('scope-warning').waitFor();
  await shot(page, 'cbam-7325-warning');
  await page.getByRole('button', { name: 'Change CN code' }).click();
  await page.getByTestId('cn-search').fill('7307 11');
  await page.getByRole('button', { name: /^7307 11/ }).click();
  await page.getByTestId('cbam-description').fill('Cast iron pipe fittings');
  await page.getByTestId('cbam-tonnes').fill('100');
  await shot(page, 'cbam-new');
  await page.getByTestId('cbam-generate').click();
  await page.waitForURL(/\/reports\/[0-9a-f-]{36}$/);
  await page.getByRole('link', { name: 'Download Excel' }).waitFor();
  await shot(page, 'cbam-report');
  await page.goto(`${WEB}/reports`);
  await page.getByText('Estimate, not verified').first().waitFor();
  await shot(page, 'reports-a-cbam');

  // ---------- Demo B: its path comes from its own rows ----------
  await page.goto(`${WEB}/start`);
  await page.getByText('Same unit, 6 months later').click();
  await page.waitForURL(/\/(consent|home)$/);
  if (page.url().endsWith('/consent')) {
    await page.getByRole('button', { name: 'I agree' }).click();
    await page.waitForURL(/\/home$/);
  }
  await page.getByTestId('progress-path').waitFor();
  await page.getByText('Latest bills').waitFor();
  await shot(page, 'home-b');
  await page.getByTestId('progress-path').click();
  await page.waitForURL(/\/progress$/);
  await page.getByTestId('stage-4').waitFor();
  await shot(page, 'progress-b');
  await page.goBack();

  // Verified savings: Home's hero -> /savings -> the method sheet -> Reports -> the demo report.
  await page.getByTestId('savings-hero').click();
  await page.waitForURL(/\/savings$/);
  await page.getByTestId('method-note').waitFor();
  await page.getByText('Verified by your bills').first().waitFor();
  await shot(page, 'savings-b');
  await page.getByRole('button', { name: 'How we measure this' }).click();
  await page.getByText('Fit error, CV(RMSE)').waitFor();
  await shot(page, 'savings-how', true);
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Reports' }).click();
  await page.waitForURL(/\/reports$/);
  await page.getByText('Shared with 1, viewed 2 times').waitFor();
  await shot(page, 'reports');
  await page.getByTestId('report-row').first().click();
  await page.waitForURL(/\/reports\/[0-9a-f-]{36}$/);
  await page.getByText('Document seal').waitFor();
  await shot(page, 'report-b');
  await page.close();

  // ---------- Telugu, 360x800 ----------
  const te = await browser.newPage({ viewport: { width: 360, height: 800 } });
  await te.addInitScript(() => localStorage.setItem('ecoproof.lang', 'te'));
  await te.goto(`${WEB}/start`);
  await te.getByText('శ్రీ లక్ష్మి కాస్టింగ్స్: ముందు').click();
  await te.waitForURL(/\/(consent|home)$/);
  if (te.url().endsWith('/consent')) {
    await te.getByRole('button', { name: 'నేను అంగీకరిస్తున్నాను' }).click();
    await te.waitForURL(/\/home$/);
  }
  await te.getByText('తాజా బిల్లులు').waitFor();
  await shot(te, 'te-home');
  await te.goto(`${WEB}/health`);
  await te.getByText('తక్కువ పవర్ ఫ్యాక్టర్').waitFor();
  await shot(te, 'te-health');
  await te.goto(`${WEB}/actions/fix_power_factor`);
  await te.getByLabel(/రుణ మొత్తం/).fill('10,00,000');
  await te.getByText('మొదటి నెల నుండే నగదు లాభం').waitFor();
  await shot(te, 'te-action-detail');
  await te.goto(`${WEB}/verify/${reportId}`);
  await te.getByText('ఈ పత్రం నిజమైనది').waitFor();
  await shot(te, 'te-verify');
  await te.goto(`${WEB}/schemes`);
  await te.getByTestId('zed-card').waitFor();
  await shot(te, 'te-schemes');
  await te.close();

  // Demo B in Telugu at 360x800: the chart must stay readable.
  const tb = await browser.newPage({ viewport: { width: 360, height: 800 } });
  await tb.addInitScript(() => localStorage.setItem('ecoproof.lang', 'te'));
  await tb.goto(`${WEB}/start`);
  await tb.getByText('అదే యూనిట్, 6 నెలల తర్వాత').click();
  await tb.waitForURL(/\/(consent|home)$/);
  if (tb.url().endsWith('/consent')) {
    await tb.getByRole('button', { name: 'నేను అంగీకరిస్తున్నాను' }).click();
    await tb.waitForURL(/\/home$/);
  }
  await tb.goto(`${WEB}/savings`);
  await tb.getByTestId('method-note').waitFor();
  await shot(tb, 'te-savings');
  await tb.close();
} finally {
  await browser.close();
}

if (problems.length) {
  console.log('\nLAYOUT PROBLEMS');
  for (const p of problems) console.log(' -', p);
} else {
  console.log('\nLayout checks: no problems');
}
