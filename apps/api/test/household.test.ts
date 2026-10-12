import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { SITE_H } from '../src/demo/ids.js';
import { computeSolarPlan } from '../src/services/solar.js';
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

  it('shows no rupees while the home tariff is a placeholder (R9)', async () => {
    const r = await request(app).get(`/sites/${siteH}/solar-plan`).set(auth(tokenH));
    expect(r.body.rateInrPerKwh).toBeNull();
    expect(r.body.monthlySavingInr).toBeNull();
    expect(r.body.paybackYears).toBeNull();
  });

  it('turns rupees on from a bill rate (test fixture, not a tariff)', async () => {
    const FIXTURE_RATE = 6; // TEST FIXTURE ONLY: not a TGSPDCL rate
    const site = await prisma.site.findFirstOrThrow({ where: { id: SITE_H } });
    const p = await computeSolarPlan(site, { rateInrPerKwh: FIXTURE_RATE });
    if (!('kwp' in p)) throw new Error('plan missing');
    expect(p.monthlySavingInr).toBeCloseTo(((2.5 * 1462.9) / 12) * FIXTURE_RATE, 1);
    expect(p.paybackYears).toBeCloseTo(p.netCostInr / (p.monthlySavingInr! * 12), 2);
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
    expect(r.body.totals.savedInr).toBeNull();
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
