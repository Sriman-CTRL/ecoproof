import request from 'supertest';
import { findBanned } from '@ecoproof/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { SITE_H } from '../src/demo/ids.js';
import { resetDemo, seedDemo } from '../prisma/demo/seed-demo.js';

const app = createApp();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
let tokenH = '';
let tokenA = '';
let siteH = '';
let siteA = '';
const bodies: unknown[] = [];

beforeAll(async () => {
  await resetDemo();
  await seedDemo({ demoReport: false });
  const h = await request(app).post('/auth/demo-login').send({ demo: 'H' });
  tokenH = h.body.token;
  siteH = h.body.site.id;
  bodies.push(h.body);
  const a = await request(app).post('/auth/demo-login').send({ demo: 'A' });
  tokenA = a.body.token;
  siteA = a.body.site.id;
});

afterAll(async () => {
  await resetDemo();
  await seedDemo();
  await prisma.$disconnect();
});

describe('household mode (Demo H)', () => {
  it('sizes 2.5 kW, limited by use, within the 3 kW sanctioned-load cap', async () => {
    const r = await request(app).get(`/sites/${siteH}/solar-plan`).set(auth(tokenH));
    expect(r.status).toBe(200);
    bodies.push(r.body);
    expect(r.body.kwp).toBeLessThanOrEqual(3);
    expect(r.body.kwp).toBe(2.5);
    expect(r.body.limitedBy).toBe('use');
    expect(r.body.inputs.annualKwh).toBe(3840);
    expect(r.body.cfaInr).toBe(69000);
    expect(r.body.benchmarkCostInr).toBe(122500);
    expect(r.body.netCostInr).toBe(r.body.benchmarkCostInr - r.body.cfaInr);
    expect(r.body.co2AvoidedT).toBeCloseTo((2.5 * 1462.9 * 0.675) / 1000, 3);
    expect(r.body.conditions).toHaveLength(3);
    expect(JSON.stringify(r.body)).not.toMatch(/300 free units/i);
  });

  it('prices every Demo H month with domesticBill at the FY 2026-27 LT-I rates', async () => {
    const r = await request(app).get(`/sites/${siteH}/months`).set(auth(tokenH));
    expect(r.body).toHaveLength(18);
    for (const m of r.body) expect(m.rupees.total, m.month).toBeGreaterThan(0);
    // Sep 2026: bought 160, sent out 170 -> billed 0 units -> customer charge 40 + fixed 3 kW x 10.
    const sep = r.body[0];
    expect(sep.billedKwh).toBe(0);
    expect(sep.rupees.total).toBe(70);
    // Apr 2025, 420 units, 3 kW: LT-I(B)(ii) 200 x 5.10 + 100 x 7.70 + 100 x 9.00 + 20 x 9.50 = 2,880 energy.
    const apr25 = r.body[17];
    expect(apr25.month).toBe('2025-04-01');
    expect(apr25.rupees.energyCharges).toBe(2880);
    expect(apr25.rupees.total).toBe(2880 + 30 + 140);
  });

  it('bills after-solar months on net units, with energy, fixed and customer stored', async () => {
    const ems = await prisma.energyMonth.findMany({
      where: { siteId: SITE_H, solarInstalledKwp: { not: null } },
      orderBy: { periodStart: 'asc' },
    });
    expect(ems).toHaveLength(6);
    for (const em of ems) {
      const o = em.otherChargesJson as {
        billedKwh: number;
        bill: { energyInr: number; fixedInr: number; customerInr: number; totalInr: number };
      };
      expect(o.billedKwh).toBe(Math.max(Number(em.kwh) - Number(em.exportKwh), 0));
      expect(o.bill.totalInr).toBeCloseTo(
        o.bill.energyInr + o.bill.fixedInr + o.bill.customerInr,
        2,
      );
    }
    // Apr 2026: bought 210, sent 190 -> 20 units: 20 x 1.95 = 39 energy, fixed 30, customer 40.
    expect(ems[0]!.otherChargesJson).toMatchObject({
      billedKwh: 20,
      bill: { energyInr: 39, fixedInr: 30, customerInr: 40, totalInr: 109 },
    });
  });

  it('plans a saving from the slabs: a number of rupees a month and a payback in years', async () => {
    const r = await request(app).get(`/sites/${siteH}/solar-plan`).set(auth(tokenH));
    expect(r.body.monthlySavingInr).toBeGreaterThan(0);
    expect(typeof r.body.paybackYears).toBe('number');
    expect(r.body.paybackYears).toBeCloseTo(r.body.netCostInr / (r.body.monthlySavingInr * 12), 1);
    expect(r.body.rateNote).toBe(
      'Uses TGSPDCL LT-I slabs (FY 2026-27); your slab drops when net units fall. Excess export credit not counted.',
    );
    // Every tariff source carries its URL, printed page and quoted line.
    const tariff = r.body.sources.filter((s: { key: string }) => s.key.startsWith('domestic_'));
    expect(tariff).toHaveLength(5);
    for (const s of tariff) {
      expect(s.url, s.key).toMatch(/^https:\/\/tgerc\./);
      expect(s.page, s.key).toBeTruthy();
      expect(s.quotedLine, s.key).toBeTruthy();
    }
  });

  it('reads six after-installation bills: import, export, saved kWh vs last year', async () => {
    const r = await request(app).get(`/sites/${siteH}/solar-results`).set(auth(tokenH));
    expect(r.status).toBe(200);
    bodies.push(r.body);
    expect(r.body.installedKwp).toBe(3);
    expect(r.body.installedFrom).toBe('2026-04-01');
    expect(r.body.months).toHaveLength(6);
    const apr = r.body.months[0];
    expect(apr).toMatchObject({ importKwh: 210, exportKwh: 190, netKwh: 20, lastYearKwh: 420 });
    expect(apr.savedKwh).toBe(400);
    expect(apr.gridTco2).toBeCloseTo((210 * 0.675) / 1000, 3); // stored to 3 dp
    expect(r.body.totals.importKwh).toBe(1180);
    expect(r.body.totals.exportKwh).toBe(980);
    // Saved Rs = same month last year's bill - this month's bill (full LT-I bill, before FSA/duty).
    expect(apr.billInr).toBe(109);
    expect(apr.lastYearBillInr).toBe(2880 + 30 + 140);
    expect(apr.savedInr).toBe(3050 - 109);
    expect(r.body.totals.savedInr).toBeGreaterThan(0);
    expect(r.body.status).toBe('too_early');
  });

  it('uses imported kWh for Scope 2 and no production or intensity fields', async () => {
    const r = await request(app).get(`/sites/${siteH}/months`).set(auth(tokenH));
    bodies.push(r.body);
    expect(r.body).toHaveLength(18);
    const sep = r.body[0];
    expect(sep.month).toBe('2026-09-01');
    expect(sep.co2.scope2TCo2Grid).toBeCloseTo((160 * 0.675) / 1000, 3);
    expect(sep.co2.label).toBe('t CO2 (grid)');
    expect(sep.exportKwh).toBe(170);
    expect(r.body.every((m: { month: string }) => m.month <= '2026-09-01')).toBe(true);
  });

  it('never mentions Gruha Jyothi, free units or 300 units in API text', () => {
    expect(JSON.stringify(bodies)).not.toMatch(/gruha|free units|300 units/i);
  });

  it('keeps our own wording clean; stored source quotes are skipped when shown in quote marks', () => {
    const quoted: string[] = [];
    const strs: string[] = [];
    const walk = (v: unknown, key = '') => {
      if (typeof v === 'string') {
        if (key === 'quotedLine') {
          quoted.push(v);
          strs.push(`“${v}”`);
        } else strs.push(v);
      } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k);
    };
    walk(bodies);
    expect(quoted.length).toBeGreaterThan(0);
    for (const s of strs) expect(findBanned(s, quoted), s).toEqual([]);
  });

  it('never returns Udyam, sector or production fields to a household', () => {
    const banned = /udyam|sector|production|intensity|gstin|yearsInOperation|cashProfits/i;
    const keys: string[] = [];
    const walk = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object')
        for (const [k, x] of Object.entries(v)) {
          keys.push(k);
          walk(x);
        }
    };
    bodies.forEach(walk);
    expect(keys.filter((k) => banned.test(k))).toEqual([]);
  });

  it('hides household solar from other orgs and from MSMEs (404)', async () => {
    for (const path of ['solar-plan', 'solar-results']) {
      expect((await request(app).get(`/sites/${siteH}/${path}`).set(auth(tokenA))).status).toBe(
        404,
      );
      expect((await request(app).get(`/sites/${siteA}/${path}`).set(auth(tokenH))).status).toBe(
        404,
      );
      expect((await request(app).get(`/sites/${siteA}/${path}`).set(auth(tokenA))).status).toBe(
        404,
      );
    }
  });
});
