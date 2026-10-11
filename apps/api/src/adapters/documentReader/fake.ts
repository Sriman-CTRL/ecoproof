import { readFileSync } from 'node:fs';
import { POWER_BILL_FIELD_NAMES, PowerBillFields } from '@ecoproof/shared';
import type { DocumentReader } from './types.js';

/** Offline demo fallback and test reader: returns the answer key with confidence 0.99. */
export class FakeReader implements DocumentReader {
  async readPowerBill() {
    const e = JSON.parse(
      readFileSync(new URL('../../../prisma/demo/bills/expected.json', import.meta.url), 'utf8'),
    ) as Record<string, unknown>;
    const fields = PowerBillFields.parse({
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
    });
    const confidence = Object.fromEntries(POWER_BILL_FIELD_NAMES.map((k) => [k, 0.99]));
    return { fields, confidence, model: 'fake' };
  }
}
