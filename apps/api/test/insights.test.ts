import { readFileSync } from 'node:fs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { resetDemo, seedDemo } from '../prisma/demo/seed-demo.js';

const app = createApp();
const bills = new URL('../prisma/demo/bills/', import.meta.url);
const cleanPng = readFileSync(new URL('bill-2026-10-clean.png', bills));

let tokenA = '';
let tokenB = '';
let siteA = '';
let siteB = '';
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  await resetDemo();
  await seedDemo();
  const a = await request(app).post('/auth/demo-login').send({ demo: 'A' });
  tokenA = a.body.token;
  siteA = a.body.site.id;
  const b = await request(app).post('/auth/demo-login').send({ demo: 'B' });
  tokenB = b.body.token;
  siteB = b.body.site.id;

  const up = await request(app)
    .post(`/sites/${siteA}/documents`)
    .set(auth(tokenA))
    .attach('file', cleanPng, 'bill.png');
  const docId = up.body.documentId as string;
  for (let i = 0; i < 60; i++) {
    const d = await request(app).get(`/documents/${docId}`).set(auth(tokenA));
    if (d.body.status === 'extracted') {
      const c = await request(app)
        .post(`/documents/${docId}/confirm`)
        .set(auth(tokenA))
        .send({ fields: d.body.fields, productionTonnes: 100, dieselLitres: 1200 });
      expect(c.status).toBe(200);
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('bill never extracted');
});

// Leave Demo A at exactly 12 months so the live Oct 2026 upload works on stage.
afterAll(async () => {
  await resetDemo();
  await seedDemo();
  await prisma.$disconnect();
});

const EXPECTED_ORDER = [
  'reduce_contracted_demand',
  'fix_power_factor',
  'igbt_furnace',
  'clean_charge_and_tapping',
  'shift_peak_use_to_solar_hours',
  'compressor_vfd',
  'screw_compressor_ring_main',
];

type F = { code: string; inrPerMonth: number | null; rule: Record<string, unknown> };

describe('bill health, insight card and action plan (Demo A, Oct 2026)', () => {
  it('flags power factor at Rs 61,200 a month with its rule row', async () => {
    const r = await request(app).get(`/sites/${siteA}/insights`).set(auth(tokenA));
    expect(r.status).toBe(200);
    expect(r.body.month).toBe('2026-10-01');
    const pf = r.body.findings.find((f: F) => f.code === 'power_factor');
    // (1,00,000 - 92,000) kVAh x Rs 7.65 (TGERC FY 2026-27 HT-I(A) 11 kV, derived from the bill)
    expect(pf.inrPerMonth).toBeCloseTo(61200, 0);
    expect(pf.rule.id).toBeTruthy();
    expect(pf.rule.source).toContain('TGERC Retail Supply Tariff Order FY 2026-27');
    expect(pf.rule.validFrom).toBe('2026-04-01');
    expect(pf.rule.line).toBe('TGSPDCL HT-I(A), FY 2026-27');
  });

  it('flags contracted demand with overpay (400 - 300) x derived demand rate', async () => {
    const r = await request(app).get(`/sites/${siteA}/insights`).set(auth(tokenA));
    const cd = r.body.findings.find((f: F) => f.code === 'contracted_demand');
    expect(cd.explain.demandRatePerKva).toBeCloseTo(500, 6); // 2,00,000 / 400 kVA billed
    expect(cd.inrPerMonth).toBeCloseTo((400 - 300) * 500, 0);
  });

  it('does not flag minimum charges, and values peak only with shiftable units', async () => {
    const r = await request(app)
      .get(`/sites/${siteA}/insights?shiftableKwh=1000`)
      .set(auth(tokenA));
    expect(r.body.findings.map((f: F) => f.code)).not.toContain('minimum_charges');
    expect(r.body.passed.map((f: F) => f.code)).toContain('minimum_charges');
    const peak = r.body.findings.find((f: F) => f.code === 'peak_use');
    expect(peak.inrPerMonth).toBeCloseTo(1000 * (1.5 + 0.5), 6);
    const none = await request(app).get(`/sites/${siteA}/insights`).set(auth(tokenA));
    expect(none.body.findings.find((f: F) => f.code === 'peak_use').inrPerMonth).toBeNull();
  });

  it('totals the card as the sum of flagged findings (peak pending counts 0)', async () => {
    const r = await request(app).get(`/sites/${siteA}/insights?month=2026-10`).set(auth(tokenA));
    expect(r.body.atStake.inrPerMonth).toBeCloseTo(61200 + 50000, 6);
    expect(r.body.atStake.pendingCodes).toEqual(['peak_use']);
    const sum = r.body.findings.reduce((t: number, f: F) => t + (f.inrPerMonth ?? 0), 0);
    expect(r.body.atStake.inrPerMonth).toBeCloseTo(sum, 6);
  });

  it('labels CO2 by source in the sentence, not with a pasted total label', async () => {
    const r = await request(app).get(`/sites/${siteA}/insights`).set(auth(tokenA));
    const { sentence, change } = r.body.insightCard;
    expect(sentence).not.toContain('t CO2 (grid) + t CO2e');
    expect(sentence).toMatch(/[\d.]+ t CO2 (more|less) from grid electricity/);
    expect(change.tCo2Grid).toBeTypeOf('number');
    if (Math.abs(change.tCo2eFuels) < 0.005) expect(sentence).not.toContain('from fuels');
  });

  it('writes an insight sentence against the same month last year', async () => {
    const r = await request(app).get(`/sites/${siteA}/insights`).set(auth(tokenA));
    expect(r.body.insightCard.comparedWith).toBe('same month last year');
    expect(r.body.insightCard.sentence).toMatch(/^Your bill is Rs /);
    expect(r.body.insightCard.baseline.method).toBeTruthy();
  });

  it('ranks a valued zero-cost fix first and returns the top 3 plus the total', async () => {
    const r = await request(app).get(`/sites/${siteA}/actions`).set(auth(tokenA));
    expect(r.status).toBe(200);
    expect(r.body.actions).toHaveLength(3);
    expect(r.body.total).toBeGreaterThanOrEqual(3);
    expect(r.body.actions[0].code).toBe('reduce_contracted_demand');
    expect(r.body.actions[0].isZeroCost).toBe(true);
    expect(r.body.actions[0].annualInrMid).toBeGreaterThan(0);
    const all = await request(app).get(`/sites/${siteA}/actions?all=1`).set(auth(tokenA));
    const pf = all.body.actions.find((a: { code: string }) => a.code === 'fix_power_factor');
    expect(pf.inrPerMonthLow).toBeCloseTo(61200, 0);
    expect(pf.co2TonnesPerYear).toBeNull();
  });

  it('prices the PF fix from the sourced range: not zero-cost, payback under 3 months', async () => {
    const r = await request(app).get(`/sites/${siteA}/actions?all=1`).set(auth(tokenA));
    const pf = r.body.actions.find((a: { code: string }) => a.code === 'fix_power_factor');
    expect(pf.isZeroCost).toBe(false);
    expect([pf.costLow, pf.costHigh]).toEqual([20000, 120000]);
    expect(pf.costYear).toBe('2011 / 2020');
    expect(pf.paybackYears * 12).toBeLessThan(3);
    expect(pf.paybackYears).toBeCloseTo(70000 / (61200 * 12), 6);
  });

  it('values the IGBT furnace from the 70-85% furnace share and 8.2% cut', async () => {
    const r = await request(app).get(`/sites/${siteA}/actions?all=1`).set(auth(tokenA));
    const months = await prisma.energyMonth.findMany({
      where: { siteId: siteA, periodStart: { lte: new Date('2026-10-01T00:00:00Z') } },
      orderBy: { periodStart: 'desc' },
      take: 12,
    });
    const yearKwh = months.reduce((t, m) => t + Number(m.kwh), 0);
    const igbt = r.body.actions.find((a: { code: string }) => a.code === 'igbt_furnace');
    expect(igbt.savingBasis).toBe('enduse_share');
    expect(igbt.kwhPerYearLow).toBeCloseTo(yearKwh * 0.7 * 0.082, 3);
    expect(igbt.kwhPerYearHigh).toBeCloseTo(yearKwh * 0.85 * 0.082, 3);
    // Low at the bill's Rs per kVAh, high at the bill's own Rs per kWh (Oct 2026 bill).
    expect(igbt.inrPerMonthLow).toBeCloseTo((igbt.kwhPerYearLow / 12) * 7.65, 3);
    expect(igbt.inrPerMonthHigh).toBeCloseTo((igbt.kwhPerYearHigh / 12) * (765000 / 92000), 3);
    expect(igbt.co2TonnesPerYear).toBeCloseTo(
      ((igbt.kwhPerYearLow + igbt.kwhPerYearHigh) / 2) * (0.675 / 1000),
      6,
    );
    const pending = r.body.actions.find((a: { code: string }) => a.code === 'compressor_vfd');
    expect(pending.savingBasis).toBe('pending_measurement');
    expect(pending.inrPerMonthLow).toBeNull();
    const codes = r.body.actions.map((a: { code: string }) => a.code);
    expect(codes).not.toContain('efficiency_measure_pending_r2');
  });

  it('orders actions: valued zero-cost by Rs, valued paid by payback, then unvalued', async () => {
    const r = await request(app).get(`/sites/${siteA}/actions?all=1`).set(auth(tokenA));
    type A = { code: string; isZeroCost: boolean; annualInrMid: number | null };
    const list = r.body.actions as A[];
    const valued = list.filter((a) => a.annualInrMid != null);
    expect(list.slice(0, valued.length)).toEqual(valued);
    const zero = valued.filter((a) => a.isZeroCost);
    expect(valued.slice(0, zero.length)).toEqual(zero);
    const rupees = zero.map((a) => a.annualInrMid!);
    expect(rupees).toEqual([...rupees].sort((a, b) => b - a));
    const unvalued = list.slice(valued.length).map((a) => a.isZeroCost);
    expect(unvalued).toEqual([...unvalued].sort((a, b) => Number(b) - Number(a)));
    expect(list.map((a) => a.code)).toEqual(EXPECTED_ORDER);
  });

  it('upserts the plan status', async () => {
    const url = `/sites/${siteA}/actions/fix_power_factor/plan`;
    const a = await request(app).post(url).set(auth(tokenA)).send({ status: 'planned' });
    expect(a.status).toBe(200);
    const b = await request(app).post(url).set(auth(tokenA)).send({ status: 'in_progress' });
    expect(b.body.status).toBe('in_progress');
    const rows = await prisma.siteAction.findMany({ where: { siteId: siteA } });
    expect(rows).toHaveLength(1);
    const list = await request(app).get(`/sites/${siteA}/actions?all=1`).set(auth(tokenA));
    expect(
      list.body.actions.find((x: { code: string }) => x.code === 'fix_power_factor').status,
    ).toBe('in_progress');
    expect((await request(app).post(url).set(auth(tokenA)).send({ status: 'bogus' })).status).toBe(
      400,
    );
  });

  it("hides another org's site (404) and needs a token (401)", async () => {
    const plan = `/sites/${siteB}/actions/fix_power_factor/plan`;
    expect(
      (await request(app).post(plan).set(auth(tokenA)).send({ status: 'planned' })).status,
    ).toBe(404);
    expect((await request(app).get(`/sites/${siteB}/insights`).set(auth(tokenA))).status).toBe(404);
    expect((await request(app).get(`/sites/${siteB}/actions`).set(auth(tokenA))).status).toBe(404);
    expect((await request(app).get(`/sites/${siteA}/insights`)).status).toBe(401);
    expect((await request(app).get(`/sites/${siteB}/insights`).set(auth(tokenB))).status).toBe(200);
  });
});
