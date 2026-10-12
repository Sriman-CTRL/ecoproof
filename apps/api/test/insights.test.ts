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

type F = { code: string; inrPerMonth: number | null; rule: Record<string, unknown> };

describe('bill health, insight card and action plan (Demo A, Oct 2026)', () => {
  it('flags power factor at Rs 60,000 a month with its rule row', async () => {
    const r = await request(app).get(`/sites/${siteA}/insights`).set(auth(tokenA));
    expect(r.status).toBe(200);
    expect(r.body.month).toBe('2026-10-01');
    const pf = r.body.findings.find((f: F) => f.code === 'power_factor');
    expect(pf.inrPerMonth).toBeCloseTo(60000, 0);
    expect(pf.rule.id).toBeTruthy();
    expect(pf.rule.source).toContain('TGSPDCL');
    expect(pf.rule.validFrom).toBe('2025-04-01');
    expect(pf.rule.line).toBe('TGSPDCL HT-I(A), FY 2025-26 (valid from inferred)');
  });

  it('flags contracted demand with overpay (400 - 300) x derived demand rate', async () => {
    const r = await request(app).get(`/sites/${siteA}/insights`).set(auth(tokenA));
    const cd = r.body.findings.find((f: F) => f.code === 'contracted_demand');
    expect(cd.explain.demandRatePerKva).toBeCloseTo(400, 6); // 1,60,000 / 400 kVA billed
    expect(cd.inrPerMonth).toBeCloseTo((400 - 300) * 400, 0);
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
    expect(r.body.atStake.inrPerMonth).toBeCloseTo(100000, 6);
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

  it('ranks zero-cost actions first and returns the top 3 plus the total', async () => {
    const r = await request(app).get(`/sites/${siteA}/actions`).set(auth(tokenA));
    expect(r.status).toBe(200);
    expect(r.body.actions).toHaveLength(3);
    expect(r.body.total).toBeGreaterThanOrEqual(3);
    expect(r.body.actions[0].isZeroCost).toBe(true);
    const all = await request(app).get(`/sites/${siteA}/actions?all=1`).set(auth(tokenA));
    const flags = all.body.actions.map((a: { isZeroCost: boolean }) => a.isZeroCost);
    expect(flags).toEqual([...flags].sort((a, b) => Number(b) - Number(a)));
    const pf = all.body.actions.find((a: { code: string }) => a.code === 'fix_power_factor');
    expect(pf.inrPerMonthLow).toBeCloseTo(60000, 0);
    expect(pf.costLow).toBeNull();
    expect(pf.paybackYears).toBeNull();
    expect(pf.co2TonnesPerYear).toBeNull();
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
