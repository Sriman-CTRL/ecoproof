// Runs GeminiReader on the sample bills and diffs against expected.json. Needs GEMINI_API_KEY.
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { GeminiReader } from '../src/adapters/documentReader/gemini.js';

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.log('GEMINI_API_KEY not set: skipping smoke test');
  process.exit(0);
}
const bills = new URL('../prisma/demo/bills/', import.meta.url);
const e = JSON.parse(readFileSync(new URL('expected.json', bills), 'utf8')) as Record<
  string,
  string | number | Record<string, number>
>;
const want: Record<string, unknown> = {
  consumerNo: e.consumer_no,
  billNo: e.bill_no,
  periodStart: e.period_start,
  periodEnd: e.period_end,
  kwh: e.kwh,
  kvah: e.kvah,
  pf: e.pf,
  mdKva: e.md_kva,
  contractedDemandKva: e.contracted_demand_kva,
  peakKwh: e.tod_peak_kwh,
  energyCharges: e.energy_charges,
  demandCharges: e.demand_charges,
  otherCharges: e.other_charges,
  total: e.total,
};

const reader = new GeminiReader(key);
let mismatches = 0;
for (const [file, mime] of [
  ['bill-2026-10-photo.png', 'image/png'],
  ['bill-2026-10.pdf', 'application/pdf'],
] as const) {
  console.log(`\n== ${file} ==`);
  try {
    const r = await reader.readPowerBill(readFileSync(new URL(file, bills)), mime);
    for (const [k, w] of Object.entries(want)) {
      const got = (r.fields as Record<string, unknown>)[k];
      const ok = JSON.stringify(got) === JSON.stringify(w);
      if (!ok) mismatches++;
      const conf = r.confidence[k]?.toFixed(2) ?? '?';
      console.log(
        `${ok ? 'match   ' : 'MISMATCH'} ${k.padEnd(20)} want=${JSON.stringify(w)} got=${JSON.stringify(got)} conf=${conf}`,
      );
    }
  } catch (err) {
    mismatches++;
    console.log(`FAILED: ${(err as Error).name}: ${(err as Error).message}`);
  }
}
console.log(`\n${mismatches} mismatch(es)`);
