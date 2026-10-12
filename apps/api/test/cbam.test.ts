import { createHash } from 'node:crypto';
import { findBanned } from '@ecoproof/shared';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { storage } from '../src/adapters/storage.js';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import {
  ELECTRICITY_NOTE,
  ESTIMATE_LABEL,
  NOT_IN_SCOPE,
  PRECURSORS_MISSING,
  STATUS_LINE,
  type CbamResults,
} from '../src/reports/cbamSheet.js';
import { resetDemo, seedDemo } from '../prisma/demo/seed-demo.js';

const app = createApp();
const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');
let tokenA = '';
let tokenB = '';
let siteA = '';
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

const FITTINGS = {
  products: [{ cnCode: '7307 11', description: 'Cast iron pipe fittings', tonnes: 100 }],
};

async function workbook(reportId: string) {
  const row = await prisma.report.findFirstOrThrow({ where: { id: reportId } });
  const file = await storage.get(row.fileKey);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(file as unknown as ArrayBuffer);
  return { row, file, wb };
}
const sheetText = (ws: ExcelJS.Worksheet) => {
  const out: string[] = [];
  ws.eachRow((r) => r.eachCell((c) => out.push(String(c.value ?? ''))));
  return out;
};

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

describe('POST /sites/:siteId/reports/cbam (REP-2)', () => {
  let fittingsId = '';

  it('7307 11, 100 t: direct only, electricity for information, default 3.859 -> 4.245, sealed', async () => {
    const r = await request(app)
      .post(`/sites/${siteA}/reports/cbam`)
      .set(auth(tokenA))
      .send(FITTINGS);
    expect(r.status).toBe(201);
    expect(r.body.version).toBe(1);
    fittingsId = r.body.reportId;

    const { row, file, wb } = await workbook(fittingsId);
    expect(row.type).toBe('cbam_sheet');
    expect(sha256(file)).toBe(row.sha256);
    expect(r.body.sha256).toBe(row.sha256);

    const snap = await prisma.reportSnapshot.findFirstOrThrow({ where: { id: row.snapshotId } });
    const res = snap.resultsJson as unknown as CbamResults;
    // Grid electricity is never part of the CBAM direct total (Annex II).
    expect(res.electricity.tCo2).toBeGreaterThan(0);
    expect(res.direct.totalTonnes).toBeCloseTo(res.direct.fuelTonnes, 9);
    expect(res.direct.seeDirect).toBeCloseTo(res.direct.totalTonnes / res.direct.outputTonnes, 9);
    expect(res.direct.precursorNote).toBe(PRECURSORS_MISSING);
    expect(res.products[0]!.defaultComparison).toMatchObject({
      defaultTotal: 3.859,
      markupPct: 10,
      withMarkup: 4.245,
      year: 2026,
    });
    expect(snap.factorIds.length).toBeGreaterThan(0);

    expect(wb.worksheets.map((w) => w.name)).toEqual([
      '1 Installation',
      '2 Goods and route',
      '3 Direct emissions',
      '4 Electricity',
      '5 Sector parameters',
      '6 EU default comparison',
      '7 Status',
    ]);
    for (const ws of wb.worksheets) expect(ws.getCell('A1').value).toBe(ESTIMATE_LABEL);
    const tab = (n: string) => sheetText(wb.getWorksheet(n)!).join('\n');
    expect(tab('4 Electricity')).toContain(ELECTRICITY_NOTE);
    expect(tab('3 Direct emissions')).toContain(PRECURSORS_MISSING);
    expect(tab('6 EU default comparison')).toContain(
      '3.859 t CO2e/t + 10% mark-up in 2026 = 4.245',
    );
    expect(tab('7 Status')).toContain(STATUS_LINE);
    expect(tab('7 Status')).toContain(snap.id);
  });

  it('the workbook passes the banned-word scan and never claims CBAM status', async () => {
    const { wb } = await workbook(fittingsId);
    const all = wb.worksheets.flatMap(sheetText);
    expect(all.length).toBeGreaterThan(50);
    for (const s of all) expect(findBanned(s), s).toEqual([]);
    expect(all.join(' ')).not.toMatch(/you beat|lower than the default|CBAM certified/i);
  });

  it('7325 is not in CBAM scope today and has no default comparison', async () => {
    const r = await request(app)
      .post(`/sites/${siteA}/reports/cbam`)
      .set(auth(tokenA))
      .send({ products: [{ cnCode: '7325', description: 'Machine castings', tonnes: 50 }] });
    expect(r.status).toBe(201);
    expect(r.body.version).toBe(2);
    const { row, wb } = await workbook(r.body.reportId);
    const snap = await prisma.reportSnapshot.findFirstOrThrow({ where: { id: row.snapshotId } });
    const p = (snap.resultsJson as unknown as CbamResults).products[0]!;
    expect(p).toMatchObject({
      inScopeNow: false,
      proposedFrom: '2028-01-01',
      defaultComparison: null,
    });
    expect(sheetText(wb.getWorksheet('2 Goods and route')!).join('\n')).toContain(NOT_IN_SCOPE);

    const view = await request(app).get(`/reports/${r.body.reportId}`).set(auth(tokenA));
    expect(view.body.headline).toMatchObject({
      kind: 'cbam_sheet',
      label: ESTIMATE_LABEL,
      products: [{ cnCode: '7325', inScopeNow: false }],
    });
    const pub = await request(app).get(`/public/reports/${r.body.reportId}/verify`);
    expect(pub.status).toBe(200);
    expect(pub.body.type).toBe('cbam_sheet');
  });

  it('pig iron entered: counted at the EU India default, purchased steel still missing', async () => {
    const r = await request(app)
      .post(`/sites/${siteA}/reports/cbam`)
      .set(auth(tokenA))
      .send({
        ...FITTINGS,
        precursors: { pigIronTonnes: 10, scrapTonnes: 80, preConsumerScrapPct: 40 },
      });
    expect(r.status).toBe(201);
    const row = await prisma.report.findFirstOrThrow({ where: { id: r.body.reportId } });
    const snap = await prisma.reportSnapshot.findFirstOrThrow({ where: { id: row.snapshotId } });
    const res = snap.resultsJson as unknown as CbamResults;
    expect(res.precursors.pigIronEmissions).toBeCloseTo(10 * 2.53, 9);
    expect(res.direct.totalTonnes).toBeCloseTo(res.direct.fuelTonnes + 25.3, 9);
    expect(res.direct.precursorNote).toContain('purchased steel');
    expect(res.sector.preConsumerScrapPct).toBe(40);
  });

  it('rejects an unknown CN code', async () => {
    const r = await request(app)
      .post(`/sites/${siteA}/reports/cbam`)
      .set(auth(tokenA))
      .send({ products: [{ cnCode: '9999', description: 'x', tonnes: 1 }] });
    expect(r.status).toBe(400);
  });

  it('CN code picker searches the reference table', async () => {
    const r = await request(app).get('/cbam/cn-codes?q=7307').set(auth(tokenA));
    expect(r.status).toBe(200);
    expect(r.body.map((c: { code: string }) => c.code)).toEqual([
      '7307 11',
      '7307 19 10',
      '7307 19 90',
    ]);
  });

  it("another org's site and report are 404", async () => {
    const r = await request(app)
      .post(`/sites/${siteA}/reports/cbam`)
      .set(auth(tokenB))
      .send(FITTINGS);
    expect(r.status).toBe(404);
    expect((await request(app).get(`/reports/${fittingsId}`).set(auth(tokenB))).status).toBe(404);
  });
});
