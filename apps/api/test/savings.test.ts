import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { DEMO_REPORT_ID } from '../src/demo/ids.js';
import { prisma } from '../src/db.js';
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
