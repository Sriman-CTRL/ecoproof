import { findBanned } from '@ecoproof/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { computeSchemes, type SchemesView } from '../src/services/schemes.js';
import { resetDemo, seedDemo } from '../prisma/demo/seed-demo.js';

const app = createApp();
let tokenA = '';
let tokenB = '';
let siteA = '';
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

/** Every human-readable string in a JSON value (keys and machine codes excluded). */
function texts(v: unknown, key = ''): string[] {
  if (typeof v === 'string')
    return ['code', 'status', 'kind', 'sourceUrl', 'bankSourceUrl'].includes(key) ? [] : [v];
  if (Array.isArray(v)) return v.flatMap((x) => texts(x, key));
  if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => texts(x, k));
  return [];
}

beforeAll(async () => {
  await resetDemo();
  await seedDemo();
  const a = await request(app).post('/auth/demo-login').send({ demo: 'A' });
  tokenA = a.body.token;
  siteA = a.body.site.id;
  const b = await request(app).post('/auth/demo-login').send({ demo: 'B' });
  tokenB = b.body.token;
});

afterAll(async () => {
  await resetDemo();
  await seedDemo();
  await prisma.$disconnect();
});

describe('GET /sites/:siteId/schemes (FIN-1)', () => {
  it('Demo A: ZED likely with Rs 10,000 money found, SIDBI 4E likely, MSE-GIFT check with lender', async () => {
    const r = await request(app).get(`/sites/${siteA}/schemes`).set(auth(tokenA));
    expect(r.status).toBe(200);
    const v = r.body as SchemesView;
    const by = new Map(v.matches.map((m) => [m.code, m]));

    expect(by.get('zed_joining_reward')).toMatchObject({
      status: 'likely',
      statusText: 'Likely eligible; confirm with the scheme office',
      lastChecked: '2026-10-12',
    });
    expect(v.moneyFound).toEqual({
      inr: 10000,
      items: [{ code: 'zed_joining_reward', label: 'ZED joining reward', inr: 10000 }],
    });
    expect(v.zed).toMatchObject({ status: 'likely', subsidyPct: 60, udyamCategory: 'small' });
    expect(v.zed!.bankConcessions.map((b) => b.bank)).toEqual([
      'SBI',
      'SIDBI',
      'Bank of Maharashtra',
      'Bank of Baroda',
    ]);
    expect(v.topMatch?.code).toBe('zed_joining_reward');

    expect(by.get('sidbi_4e')?.status).toBe('likely');
    expect(by.get('mse_gift')).toMatchObject({
      status: 'check_lender',
      statusText: 'Check with lender',
    });
    expect(by.get('sidbi_gfs')?.status).toBe('check_lender');
    expect(by.get('adeetie')).toMatchObject({
      status: 'check_office',
      statusText: 'Check with the scheme office',
    });
    expect(by.get('adeetie')?.reason).toContain('Hyderabad cluster is not confirmed');
    for (const code of ['tg_cleaner_production', 'tg_quality_reimbursement']) {
      expect(by.get(code)).toMatchObject({
        status: 'not_eligible',
        statusText: 'Not eligible: for new units or expansions only',
      });
    }
    // Subventions and percentages never reach the counter.
    expect(v.moneyFound.items.every((i) => i.code === 'zed_joining_reward')).toBe(true);
    for (const m of v.matches) expect(m.stale).toBe(false);
  });

  it('never says the bare word "eligible" (or any banned word) in API text', async () => {
    const r = await request(app).get(`/sites/${siteA}/schemes`).set(auth(tokenA));
    const all = texts(r.body);
    expect(all.length).toBeGreaterThan(20);
    for (const s of all) expect(findBanned(s), s).toEqual([]);
  });

  // The clock is injected (a faked Date would also expire the demo login token).
  it('flags rules last checked more than 60 days ago as stale', async () => {
    const site = await prisma.site.findFirstOrThrow({ where: { id: siteA } });
    const late = await computeSchemes(site, new Date('2026-12-12T12:00:00Z')); // 61 days on
    expect(late.matches.length).toBeGreaterThan(0);
    for (const m of late.matches) expect(m.stale).toBe(true);
    expect(late.zed?.stale).toBe(true);
    const edge = await computeSchemes(site, new Date('2026-12-11T00:00:00Z')); // exactly 60 days
    for (const m of edge.matches) expect(m.stale).toBe(false);
  });

  it('a medium unit is not eligible for MSE-GIFT; missing profile data is never "likely"', async () => {
    const orgId = (await prisma.site.findFirstOrThrow({ where: { id: siteA } })).orgId;
    await prisma.organisation.update({
      where: { id: orgId },
      data: { udyamCategory: 'medium', yearsInOperation: null },
    });
    try {
      const r = await request(app).get(`/sites/${siteA}/schemes`).set(auth(tokenA));
      const by = new Map((r.body as SchemesView).matches.map((m) => [m.code, m]));
      expect(by.get('mse_gift')).toMatchObject({
        status: 'not_eligible',
        statusText: 'Not eligible: for micro and small units only',
      });
      expect(by.get('sidbi_4e')?.status).toBe('check_lender');
      expect(by.get('sidbi_4e')?.reason).toContain('years in operation');
      expect((r.body as SchemesView).zed?.subsidyPct).toBe(50);
    } finally {
      await seedDemo();
    }
  });

  it("another org's site is 404", async () => {
    const r = await request(app).get(`/sites/${siteA}/schemes`).set(auth(tokenB));
    expect(r.status).toBe(404);
  });
});
