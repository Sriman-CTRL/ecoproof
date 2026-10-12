// SYNTHETIC DEMO DATA. Renders the Oct 2026 sample bill (Demo A live upload) as PNG, PDF and a phone-photo PNG.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const dir = (f: string) => fileURLToPath(new URL(f, import.meta.url));
const A = JSON.parse(readFileSync(dir('../assumptions.json'), 'utf8')) as Record<string, number>;
const inr = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);

// Oct 2026 live-upload bill values (S3 prompt, step 2).
const kwh = 92000;
const kvah = 100000;
const mdKva = A.mdKva!;
const peak = 23000;
const energyCharges = kvah * A.energyRatePerKvah!;
const demandCharges = Math.max(mdKva, 0.8 * A.contractedDemandKva!) * A.demandRatePerKva!;
const customerCharge = A.customerChargePerMonth!;
const total = energyCharges + demandCharges + customerCharge;
const pf = kwh / kvah;

const values: Record<string, string> = {
  consumerNo: 'SAMPLE-HT-0001',
  periodFrom: '01-Oct-2026',
  periodTo: '31-Oct-2026',
  billNo: 'SAMPLE-2026-10',
  kwh: inr(kwh),
  kvah: inr(kvah),
  md: inr(mdKva),
  cd: inr(A.contractedDemandKva!),
  pf: pf.toFixed(2),
  peak: inr(peak),
  energyCharges: inr(energyCharges),
  demandCharges: inr(demandCharges),
  customerCharge: inr(customerCharge),
  total: inr(total),
};

const expected = {
  _label: 'SYNTHETIC DEMO DATA - answer key for extraction tests',
  consumer_no: 'SAMPLE-HT-0001',
  bill_no: 'SAMPLE-2026-10',
  period_start: '2026-10-01',
  period_end: '2026-10-31',
  kwh,
  kvah,
  md_kva: mdKva,
  contracted_demand_kva: A.contractedDemandKva,
  pf: Number(pf.toFixed(2)),
  tod_peak_kwh: peak,
  energy_charges: energyCharges,
  demand_charges: demandCharges,
  other_charges: { customer_charge: customerCharge, low_pf_surcharge: 0 },
  total,
  production_tonnes: 100,
  diesel_litres: A.dieselLitresPerMonth,
};

const template = readFileSync(dir('./bill-template.html'), 'utf8');
const html = template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
  const v = values[k];
  if (v === undefined) throw new Error(`template field ${k} has no value`);
  return v;
});

let browser;
try {
  browser = await chromium.launch();
} catch {
  console.error(
    'Chromium is missing. Install it with:\n  pnpm exec playwright install --with-deps chromium',
  );
  process.exit(1);
}
const page = await browser.newPage({
  viewport: { width: 794, height: 1123 },
  deviceScaleFactor: 2,
});
await page.setContent(html, { waitUntil: 'load' });
await page.screenshot({ path: dir('./bill-2026-10-clean.png') });
await page.pdf({ path: dir('./bill-2026-10.pdf'), format: 'A4', printBackground: true });

// Phone-photo look: ~3 degree rotation, slight blur, lower contrast, grey backdrop.
const photoHtml = `<!doctype html><body style="margin:0;background:#8a8a85;width:900px;height:1250px;overflow:hidden">
<div style="position:absolute;left:53px;top:63px;transform:rotate(3deg);filter:blur(0.8px) contrast(0.78) brightness(0.96);
box-shadow:0 6px 24px rgba(0,0,0,.45)"><iframe style="border:0;width:794px;height:1123px" srcdoc="${html.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></iframe></div></body>`;
const photo = await browser.newPage({
  viewport: { width: 900, height: 1250 },
  deviceScaleFactor: 1.5,
});
await photo.setContent(photoHtml, { waitUntil: 'load' });
await photo.screenshot({ path: dir('./bill-2026-10-photo.png') });
await browser.close();

writeFileSync(dir('./expected.json'), `${JSON.stringify(expected, null, 2)}\n`);
console.log(
  'Rendered bill-2026-10-clean.png, bill-2026-10.pdf, bill-2026-10-photo.png, expected.json',
);
