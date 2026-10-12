import { createHash } from 'node:crypto';
import { findBanned } from '@ecoproof/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { storage } from '../src/adapters/storage.js';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import {
  CALCULATED_TEXT,
  carbonFooter,
  renderCarbonHtml,
  STAMP_TEXT,
  type CarbonStatementResults,
} from '../src/reports/carbonStatement.js';
import { pdfRenderer } from '../src/reports/pdfRenderer.js';
import { resetDemo, seedDemo } from '../prisma/demo/seed-demo.js';

const app = createApp();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'");
const login: Record<'A' | 'B' | 'H', { token: string; site: string }> = {
  A: { token: '', site: '' },
  B: { token: '', site: '' },
  H: { token: '', site: '' },
};

beforeAll(async () => {
  await resetDemo();
  await seedDemo({ demoReport: false });
  for (const demo of ['A', 'B', 'H'] as const) {
    const r = await request(app).post('/auth/demo-login').send({ demo });
    login[demo] = { token: r.body.token, site: r.body.site.id };
  }
});

afterAll(async () => {
  await pdfRenderer.close();
  await resetDemo();
  await seedDemo();
  await prisma.$disconnect();
});

const carbonOf = (d: 'A' | 'B' | 'H') =>
  request(app).get(`/sites/${login[d].site}/carbon`).set(auth(login[d].token));

describe('GET /sites/:id/carbon', () => {
  it('Demo A: latest month from its results row, grid factor row and real method lines', async () => {
    const r = await carbonOf('A');
    expect(r.status).toBe(200);
    const l = r.body.latestMonth;
    const result = await prisma.result.findFirstOrThrow({
      where: { siteId: login.A.site, month: new Date(`${l.month}T00:00:00Z`) },
    });
    expect(l.scope2T).toBeCloseTo(Number(result.scope2), 6);
    expect(l.scope1T).toBeCloseTo(Number(result.scope1), 6);
    expect(l.totalT).toBeCloseTo(Number(result.scope2) + Number(result.scope1), 3);
    expect(l.intensityTPerTonne).toBeCloseTo(Number(result.intensity), 6);
    expect(result.factorIds).toContain(l.factor.id);
    expect(l.factor).toMatchObject({ value: 0.675, version: 'v22.0' });
    // Method line rebuilt from the same inputs: kWh x factor / 1000 = scope 2.
    expect(l.scope2T).toBeCloseTo((l.kwh * l.factor.value) / 1000, 3);
    expect(r.body.method.lines[0]).toMatch(
      /kWh x 0\.675 t CO2\/MWh \/ 1000 = [\d.]+ t CO2 \(grid\)/,
    );
    expect(r.body.method.lines.some((x: string) => x.includes('L diesel'))).toBe(true);
    expect(r.body.months).toHaveLength(12);
    expect(r.body.months.at(-1).month).toBe(l.month);
    const pct = r.body.bySource.reduce((t: number, s: { pct: number }) => t + s.pct, 0);
    expect(pct).toBeCloseTo(100, 0);
    expect(r.body.bySource.map((s: { source: string }) => s.source)).toEqual([
      'grid_electricity',
      'diesel',
    ]);
    expect(r.body.label).toBe('t CO2 (grid) + t CO2e (fuels)');
    expect(r.body.savedSoFar).toBeNull();
  });

  it('Demo A: IGBT cuts CO2; contracted demand and power factor are bill charges only', async () => {
    const r = await carbonOf('A');
    const igbt = r.body.reducible.find(
      (a: { actionCode: string }) => a.actionCode === 'igbt_furnace',
    );
    expect(igbt.tPerYearLow).toBeGreaterThan(0);
    expect(igbt.tPerYearHigh).toBeGreaterThan(igbt.tPerYearLow);
    const charge = r.body.chargeOnly.map((a: { actionCode: string }) => a.actionCode);
    expect(charge).toEqual(
      expect.arrayContaining(['reduce_contracted_demand', 'fix_power_factor']),
    );

    const all = await request(app)
      .get(`/sites/${login.A.site}/actions?all=1`)
      .set(auth(login.A.token));
    const by = (c: string) => all.body.actions.find((a: { code: string }) => a.code === c);
    for (const code of ['reduce_contracted_demand', 'fix_power_factor']) {
      expect(by(code).co2).toBeNull();
      expect(by(code).co2Note).toBe('bill_charge_only');
    }
    // Same kWh basis as the rupees: t = kWh / 1000 x the grid factor, low with low, high with high.
    const a = by('igbt_furnace');
    expect(a.co2.factorId).toBe(r.body.latestMonth.factor.id);
    expect(a.co2.tPerYearLow).toBeCloseTo((a.kwhPerYearLow * 0.675) / 1000, 6);
    expect(a.co2.tPerYearHigh).toBeCloseTo((a.kwhPerYearHigh * 0.675) / 1000, 6);
    expect(a.co2TonnesPerYear).toBeCloseTo((a.co2.tPerYearLow + a.co2.tPerYearHigh) / 2, 6);
    expect(a.co2Note).toBeNull();
  });

  it('Demo B: CO2 avoided so far from the savings ledger, verified months counted', async () => {
    const r = await carbonOf('B');
    expect(r.status).toBe(200);
    const s = await request(app).get(`/sites/${login.B.site}/savings`).set(auth(login.B.token));
    expect(r.body.savedSoFar.tco2).toBeCloseTo(s.body.totals.savedTco2, 3);
    expect(r.body.savedSoFar.months).toBe(s.body.months.length);
    const verified = s.body.months
      .filter((m: { status: string }) => m.status === 'verified')
      .reduce((t: number, m: { savedTco2: number }) => t + m.savedTco2, 0);
    expect(r.body.savedSoFar.verifiedTco2).toBeCloseTo(verified, 3);
  });

  it('Demo H: grid only, no intensity, and the solar plan avoided t a year', async () => {
    const r = await carbonOf('H');
    expect(r.status).toBe(200);
    expect(r.body.household).toBe(true);
    expect(r.body.latestMonth.scope1T).toBe(0);
    expect(r.body.latestMonth.intensity).toBeNull();
    expect(r.body.label).toBe('t CO2 (grid)');
    expect(r.body.reducible).toEqual([]);
    const plan = await request(app)
      .get(`/sites/${login.H.site}/solar-plan`)
      .set(auth(login.H.token));
    expect(r.body.solar).toEqual({ kwp: plan.body.kwp, tPerYear: plan.body.co2AvoidedT });
  });

  it("keeps each org's carbon apart (404)", async () => {
    const r = await request(app).get(`/sites/${login.B.site}/carbon`).set(auth(login.A.token));
    expect(r.status).toBe(404);
  });
});

describe('carbon footprint statement', () => {
  let reportId = '';

  it('Demo B: sealed PDF, snapshot, stamp only for verified CO2, no banned words', async () => {
    const r = await request(app)
      .post(`/sites/${login.B.site}/reports/carbon-statement`)
      .set(auth(login.B.token))
      .send({});
    expect(r.status).toBe(201);
    expect(r.body.version).toBe(1);
    reportId = r.body.reportId;

    const row = await prisma.report.findFirstOrThrow({
      where: { id: reportId },
      include: { snapshot: true },
    });
    expect(row.type).toBe('carbon_statement');
    const stored = await storage.get(row.fileKey);
    expect(stored.subarray(0, 5).toString()).toBe('%PDF-');
    expect(sha256(stored)).toBe(row.sha256);
    expect(row.sha256).toBe(r.body.sha256);

    const s = row.snapshot.resultsJson as unknown as CarbonStatementResults;
    expect(s.carbon.savedSoFar!.verifiedTco2).toBeGreaterThan(0);
    expect(row.snapshot.factorIds.length).toBeGreaterThan(0);
    const html = await renderCarbonHtml(s, row.snapshotId);
    expect(html).toContain('Carbon footprint statement');
    expect(html).toContain(STAMP_TEXT);
    expect(html).toContain('Sample data (synthetic)');
    expect(html).toContain('0.675 t CO2/MWh');
    expect(html).not.toMatch(/certificate|certified/i);
    expect(findBanned(text(html))).toEqual([]);
    expect(findBanned(text(carbonFooter(reportId)))).toEqual([]);
  });

  it('Demo A: no ledger yet, so no avoided block and no stamp', async () => {
    const r = await request(app)
      .post(`/sites/${login.A.site}/reports/carbon-statement`)
      .set(auth(login.A.token))
      .send({});
    expect(r.status).toBe(201);
    const row = await prisma.report.findFirstOrThrow({
      where: { id: r.body.reportId },
      include: { snapshot: true },
    });
    const s = row.snapshot.resultsJson as unknown as CarbonStatementResults;
    const html = await renderCarbonHtml(s, row.snapshotId);
    expect(html).not.toContain(STAMP_TEXT);
    expect(findBanned(text(html))).toEqual([]);
    // A ledger without verified months says "Calculated from your bills", never the stamp.
    const unverified = await renderCarbonHtml(
      { ...s, carbon: { ...s.carbon, savedSoFar: { tco2: 1.5, months: 2, verifiedTco2: 0 } } },
      row.snapshotId,
    );
    expect(unverified).toContain(CALCULATED_TEXT);
    expect(unverified).not.toContain(STAMP_TEXT);
  });

  it('public verify shows the carbon headline only', async () => {
    const r = await request(app).get(`/public/reports/${reportId}/verify`);
    expect(r.status).toBe(200);
    expect(r.body.type).toBe('carbon_statement');
    expect(r.body.headline.kind).toBe('carbon_statement');
    expect(r.body.headline.avoidedVerified).toBe(true);
    expect(r.body.headline.totalT).toBeGreaterThan(0);
    const list = await request(app).get(`/sites/${login.B.site}/reports`).set(auth(login.B.token));
    expect(list.body.map((x: { id: string }) => x.id)).toContain(reportId);
  });

  it("keeps each org's statements apart (404)", async () => {
    const other = await request(app)
      .post(`/sites/${login.B.site}/reports/carbon-statement`)
      .set(auth(login.A.token))
      .send({});
    expect(other.status).toBe(404);
    expect((await request(app).get(`/reports/${reportId}`).set(auth(login.A.token))).status).toBe(
      404,
    );
  });
});
