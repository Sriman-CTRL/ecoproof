import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { DEMO_CARBON_STATEMENT_ID, DEMO_REPORT_ID, ORG_A, ORG_B } from '../src/demo/ids.js';
import { pdfRenderer } from '../src/reports/pdfRenderer.js';
import { clearPublicSampleCache } from '../src/services/publicSample.js';
import { resetDemo, seedDemo } from '../prisma/demo/seed-demo.js';

const app = createApp();

beforeAll(async () => {
  await resetDemo();
  await seedDemo();
  clearPublicSampleCache();
});

afterAll(async () => {
  await pdfRenderer.close();
  await prisma.$disconnect();
});

describe('demo seed: fixed ids and dates', () => {
  it('re-seeds the pitch-deck carbon statement under its fixed id (Demo A)', async () => {
    const r = await request(app).get(`/public/reports/${DEMO_CARBON_STATEMENT_ID}/verify`);
    expect(r.status).toBe(200);
    expect(r.body.type).toBe('carbon_statement');
    expect(r.body.businessName).toBe('Sri Lakshmi Castings (sample)');
    expect(r.body.headline.month).toBe('2026-09-01');
    const report = await prisma.report.findUniqueOrThrow({
      where: { id: DEMO_CARBON_STATEMENT_ID },
    });
    expect(report.orgId).toBe(ORG_A);
  });

  it('keeps the stable loan-ready summary id for Demo B', async () => {
    const r = await request(app).get(`/public/reports/${DEMO_REPORT_ID}/verify`);
    expect(r.status).toBe(200);
    expect(r.body.type).toBe('loan_pack');
  });

  it('no demo bill, ledger month or action falls after Sep 2026 (demo day 13 Oct 2026)', async () => {
    const after = new Date('2026-10-01T00:00:00Z');
    const where = { orgId: { in: [ORG_A, ORG_B] } };
    expect(
      await prisma.energyMonth.count({ where: { ...where, periodStart: { gte: after } } }),
    ).toBe(0);
    expect(await prisma.savingsLedger.count({ where: { ...where, month: { gte: after } } })).toBe(
      0,
    );
    expect(await prisma.siteAction.count({ where: { ...where, doneAt: { gte: after } } })).toBe(0);
    const b = await prisma.energyMonth.findMany({
      where: { orgId: ORG_B },
      orderBy: { periodStart: 'asc' },
    });
    expect(b).toHaveLength(18);
    expect(b[0]!.periodStart.toISOString().slice(0, 10)).toBe('2025-04-01');
    expect(b.at(-1)!.periodStart.toISOString().slice(0, 10)).toBe('2026-09-01');
  });
});

describe('GET /public/sample', () => {
  it('serves Demo A carbon, actions and factors and Demo H solar without a login', async () => {
    const r = await request(app).get('/public/sample');
    expect(r.status).toBe(200);
    expect(Object.keys(r.body).sort()).toEqual([
      'actions',
      'carbon',
      'factors',
      'household',
      'sample',
    ]);
    expect(r.body.sample).toBe(true);
    expect(r.body.carbon.latestMonth.factor).toMatchObject({ value: 0.675, version: 'v22.0' });
    expect(r.body.carbon.method.lines.length).toBeGreaterThan(0);
    expect(r.body.household.plan.co2AvoidedT).toBeGreaterThan(0);
    for (const f of r.body.factors)
      expect(r.body.carbon.factorIds.concat(r.body.household.plan.factorIds)).toContain(f.id);
    // No phone numbers, user ids or tokens leave here.
    const raw = JSON.stringify(r.body);
    expect(raw).not.toMatch(/SAMPLE-000\d|phone|token|userId/i);
  });

  it('IGBT furnace: rupees and CO2 come from the same kWh range', async () => {
    const r = await request(app).get('/public/sample');
    const igbt = r.body.actions.find((a: { code: string }) => a.code === 'igbt_furnace');
    expect(igbt).toBeTruthy();
    expect(igbt.inrPerMonthLow).toBeGreaterThan(0);
    expect(igbt.inrPerMonthHigh).toBeGreaterThanOrEqual(igbt.inrPerMonthLow);
    const grid = r.body.carbon.latestMonth.factor.value; // t CO2 per MWh
    expect(igbt.co2.tPerYearLow).toBeCloseTo((igbt.kwhPerYearLow * grid) / 1000, 1);
    expect(igbt.co2.tPerYearHigh).toBeCloseTo((igbt.kwhPerYearHigh * grid) / 1000, 1);
  });
});
