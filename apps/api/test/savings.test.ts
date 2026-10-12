import request from 'supertest';
import { fitBaseline } from '@ecoproof/calc';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { DEMO_REPORT_ID } from '../src/demo/ids.js';
import { prisma } from '../src/db.js';
import { BASELINE_RULES } from '../src/services/insights.js';
import { resetDemo, seedDemo } from '../prisma/demo/seed-demo.js';

const app = createApp();
let tokenA = '';
let tokenB = '';
let siteA = '';
let siteB = '';
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

interface Month {
  month: string;
  adjustedBaselineKwh: number;
  actualKwh: number;
  savedKwh: number;
  savedInr: number;
  savedTco2: number;
  cumulativeInr: number;
  status: 'verified' | 'too_early';
}

beforeAll(async () => {
  await resetDemo();
  await seedDemo();
  const a = await request(app).post('/auth/demo-login').send({ demo: 'A' });
  tokenA = a.body.token;
  siteA = a.body.site.id;
  const b = await request(app).post('/auth/demo-login').send({ demo: 'B' });
  tokenB = b.body.token;
  siteB = b.body.site.id;
});

afterAll(async () => {
  await resetDemo();
  await seedDemo();
  await prisma.$disconnect();
});

describe('GET /sites/:siteId/savings', () => {
  it('Demo B: every month has a status and the totals add up', async () => {
    const r = await request(app).get(`/sites/${siteB}/savings`).set(auth(tokenB));
    expect(r.status).toBe(200);
    const months = r.body.months as Month[];
    expect(months.length).toBeGreaterThan(0);
    for (const m of months) expect(['verified', 'too_early']).toContain(m.status);
    const sum = (f: (m: Month) => number) => months.reduce((s, m) => s + f(m), 0);
    expect(r.body.totals.savedInr).toBeCloseTo(
      sum((m) => m.savedInr),
      2,
    );
    expect(r.body.totals.savedKwh).toBeCloseTo(
      sum((m) => m.savedKwh),
      2,
    );
    expect(r.body.totals.verifiedInr).toBeCloseTo(
      sum((m) => (m.status === 'verified' ? m.savedInr : 0)),
      2,
    );
    expect(r.body.totals.verifiedInr).toBeLessThanOrEqual(r.body.totals.savedInr);
    for (let i = 1; i < months.length; i++) {
      expect(months[i]!.cumulativeInr).toBeGreaterThanOrEqual(months[i - 1]!.cumulativeInr);
    }
    expect(months.at(-1)!.cumulativeInr).toBeCloseTo(r.body.totals.savedInr, 2);
    expect(r.body.thisMonth).toMatchObject({ month: months.at(-1)!.month });
    expect(r.body.baseline).toMatchObject({ passes: true });
    expect(r.body.actions.length).toBeGreaterThan(0);
    expect(r.body.methodNote).toContain('not a third-party verification');
  });

  it('Demo B: cvRmsePct and nmbePct are percents (0-100), refit from the baseline months', async () => {
    const r = await request(app).get(`/sites/${siteB}/savings`).set(auth(tokenB));
    const b = r.body.baseline as { cvRmsePct: number; nmbePct: number; passes: boolean };
    expect(r.body.baseline).not.toHaveProperty('cvRmse');
    const row = await prisma.baseline.findFirstOrThrow({ where: { siteId: siteB } });
    const [energy, production] = await Promise.all([
      prisma.energyMonth.findMany({
        where: { siteId: siteB, periodStart: { gte: row.start, lte: row.end } },
        orderBy: { periodStart: 'asc' },
      }),
      prisma.productionMonth.findMany({ where: { siteId: siteB } }),
    ]);
    const tonnes = new Map(production.map((p) => [p.month.toISOString(), Number(p.quantity)]));
    const fit = fitBaseline({
      months: energy.map((e) => ({
        kwh: Number(e.kwh),
        productionTonnes: tonnes.get(e.periodStart.toISOString())!,
      })),
      rules: BASELINE_RULES,
    });
    // fitBaseline returns 100 * s / mean: the API value is that percent, not a fraction.
    expect(b.cvRmsePct).toBeCloseTo(fit.cvRmsePct!, 3);
    expect(b.nmbePct).toBeCloseTo(fit.nmbePct!, 3);
    expect(b.cvRmsePct).toBeLessThanOrEqual(BASELINE_RULES.maxCvRmsePct);
    expect(b.passes).toBe(true);
  });

  it('Demo A: empty state with a reason', async () => {
    const r = await request(app).get(`/sites/${siteA}/savings`).set(auth(tokenA));
    expect(r.status).toBe(200);
    expect(r.body.months).toEqual([]);
    expect(r.body.totals).toEqual({ savedInr: 0, savedKwh: 0, savedTco2: 0, verifiedInr: 0 });
    expect(r.body.thisMonth).toBeNull();
    expect(typeof r.body.reason).toBe('string');
  });

  it('another org gets 404', async () => {
    const r = await request(app).get(`/sites/${siteB}/savings`).set(auth(tokenA));
    expect(r.status).toBe(404);
  });
});

describe('GET /sites/:siteId/reports', () => {
  it('Demo B lists the stable demo report with its share and views', async () => {
    const r = await request(app).get(`/sites/${siteB}/reports`).set(auth(tokenB));
    expect(r.status).toBe(200);
    const demo = (r.body as Array<Record<string, unknown>>).find((x) => x.id === DEMO_REPORT_ID);
    expect(demo).toMatchObject({ type: 'loan_pack', shareCount: 1, viewCount: 2 });
    expect(demo).toHaveProperty('version');
    expect(demo).toHaveProperty('createdAt');
  });

  it('another org gets 404', async () => {
    const r = await request(app).get(`/sites/${siteB}/reports`).set(auth(tokenA));
    expect(r.status).toBe(404);
  });
});
