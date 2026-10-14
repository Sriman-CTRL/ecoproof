import { describe, expect, it } from 'vitest';
import {
  daysInPeriod,
  kwhPerTonneBand,
  loadFactor,
  pdfFlags,
  readPdfMeta,
  recomputeBill,
} from './billChecks';

// SYNTHETIC sample bill (apps/api/prisma/demo/bills/expected.json) at TGERC FY 2026-27 HT-I(A) rates.
const sample = {
  kvah: 100000,
  mdKva: 300,
  contractedDemandKva: 500,
  energyRateInrPerKvah: 7.65,
  demandRateInrPerKva: 500,
  minKvahPerKvaBillingDemand: 50,
  billingDemandFloorShare: 0.8,
  printed: { energy: 765000, demand: 200000, other: 2000, total: 967000 },
};

describe('recomputeBill (A1)', () => {
  it('the sample bill adds up', () => {
    const r = recomputeBill(sample);
    expect(r.billingDemandKva).toBe(400);
    expect(r.expected).toEqual({ energy: 765000, demand: 200000, total: 967000 });
    expect(r.pass).toBe(true);
  });
  it('lowered kVAh with unchanged rupee lines does not add up', () => {
    const r = recomputeBill({ ...sample, kvah: 25000 });
    expect(r.expected.energy).toBe(191250);
    expect(r.pass).toBe(false);
  });
  it('uses recorded MD when above 80% of contracted demand, and the 1% tolerance', () => {
    const r = recomputeBill({
      ...sample,
      mdKva: 450,
      printed: { energy: 765000, demand: 225000 * 1.009, other: 2000, total: null },
    });
    expect(r.billingDemandKva).toBe(450);
    expect(r.pass).toBe(true);
  });
  it('applies the minimum kVAh per kVA of billing demand', () => {
    expect(recomputeBill({ ...sample, kvah: 10000 }).expected.energy).toBe(20000 * 7.65);
  });
});

describe('loadFactor (A3)', () => {
  it('passes the sample and fails an impossible month', () => {
    expect(daysInPeriod('2026-10-01', '2026-10-31')).toBe(31);
    expect(loadFactor({ kvah: 100000, mdKva: 300, days: 31 }).pass).toBe(true);
    expect(loadFactor({ kvah: 300000, mdKva: 300, days: 31 }).pass).toBe(false);
  });
});

describe('kwhPerTonneBand (C1)', () => {
  it('920 kWh/t is inside, 230 kWh/t is unusual', () => {
    expect(kwhPerTonneBand({ kwh: 92000, tonnes: 100 }).inBand).toBe(true);
    const low = kwhPerTonneBand({ kwh: 23000, tonnes: 100 });
    expect(low.inBand).toBe(false);
    expect([low.low, low.high]).toEqual([310, 1240]);
  });
});

const pdf = (info: string, body = '/Type /Page /Type /Font') =>
  new TextEncoder().encode(`%PDF-1.4\n1 0 obj <<${info}>> endobj\n${body}\n%%EOF`);

describe('readPdfMeta + pdfFlags (A4)', () => {
  it('a Chromium-made bill PDF has no flags', () => {
    const m = readPdfMeta(
      pdf('/Creator (Chromium) /Producer (Skia/PDF m156) /CreationDate (D:20261012093307)'),
    )!;
    expect(m).toMatchObject({
      producer: 'Skia/PDF m156',
      creationDate: '2026-10-12',
      fontCount: 1,
    });
    expect(pdfFlags(m, { periodStart: '2026-10-01' })).toEqual([]);
  });
  it('flags an editor, a file older than the period, and a flat image', () => {
    const m = readPdfMeta(
      pdf('/Producer (Microsoft Word) /CreationDate (D:20260901)', '/Type /Page /Subtype /Image'),
    )!;
    expect(pdfFlags(m, { periodStart: '2026-10-01' }).map((f) => f.code)).toEqual([
      'editor',
      'made_before_period',
      'flat_image',
    ]);
  });
  it('is not a PDF', () => {
    expect(readPdfMeta(new TextEncoder().encode('PNG'))).toBeNull();
  });
});
