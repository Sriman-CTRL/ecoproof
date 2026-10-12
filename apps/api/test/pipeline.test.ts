import { readFileSync } from 'node:fs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { DEMOS } from '../src/demo/ids.js';
import { resetDemo, seedDemo } from '../prisma/demo/seed-demo.js';

const app = createApp();
const bills = new URL('../prisma/demo/bills/', import.meta.url);
const expected = JSON.parse(readFileSync(new URL('expected.json', bills), 'utf8'));
const cleanPng = readFileSync(new URL('bill-2026-10-clean.png', bills));

let tokenA = '';
let tokenB = '';
let siteA = '';
let siteB = '';
let docId = '';
let resultId = '';
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

const manualFields = (over: Record<string, unknown> = {}) => ({
  consumerNo: 'SAMPLE-HT-0001',
  billNo: 'SAMPLE-2026-11',
  periodStart: '2026-11-01',
  periodEnd: '2026-11-30',
  kwh: '90,000',
  kvah: 97000,
  pf: 0.93,
  mdKva: 300,
  contractedDemandKva: 500,
  peakKwh: 22000,
  energyCharges: '7,42,050',
  demandCharges: 200000,
  otherCharges: { customer_charge: 2000, low_pf_surcharge: 0 },
  total: 944050,
  ...over,
});

async function waitForStatus(id: string, status: string) {
  for (let i = 0; i < 60; i++) {
    const r = await request(app).get(`/documents/${id}`).set(auth(tokenA));
    if (r.body.status === status) return r;
    await new Promise((res) => setTimeout(res, 500));
  }
  throw new Error(`document ${id} never reached ${status}`);
}

beforeAll(async () => {
  await resetDemo();
  await seedDemo();
});

// Leave Demo A at exactly 12 months so the live Oct 2026 upload works on stage.
afterAll(async () => {
  await resetDemo();
  await seedDemo();
  await prisma.$disconnect();
});

describe('bill pipeline', () => {
  it('logs in as Demo A and Demo B', async () => {
    const a = await request(app).post('/auth/demo-login').send({ demo: 'A' });
    expect(a.status).toBe(200);
    expect(a.body.org.id).toBe(DEMOS.A.orgId);
    tokenA = a.body.token;
    siteA = a.body.site.id;
    const b = await request(app).post('/auth/demo-login').send({ demo: 'B' });
    tokenB = b.body.token;
    siteB = b.body.site.id;
    expect((await request(app).post('/auth/demo-login').send({ demo: 'C' })).status).toBe(400);
    expect((await request(app).get(`/sites/${siteA}/months`)).status).toBe(401);
  });

  it('returns 403 CONSENT_REQUIRED without consent, then works once restored', async () => {
    const saved = await prisma.consent.findMany({ where: { orgId: DEMOS.A.orgId } });
    await prisma.consent.deleteMany({ where: { orgId: DEMOS.A.orgId } });
    try {
      const r = await request(app)
        .post(`/sites/${siteA}/documents`)
        .set(auth(tokenA))
        .attach('file', cleanPng, 'bill.png');
      expect(r.status).toBe(403);
      expect(r.body.code).toBe('CONSENT_REQUIRED');
    } finally {
      await prisma.consent.createMany({ data: saved });
    }
  });

  it('accepts an upload (202) and reports a duplicate as already_received', async () => {
    const r = await request(app)
      .post(`/sites/${siteA}/documents`)
      .set(auth(tokenA))
      .attach('file', cleanPng, 'bill.png');
    expect(r.status).toBe(202);
    docId = r.body.documentId;
    const dup = await request(app)
      .post(`/sites/${siteA}/documents`)
      .set(auth(tokenA))
      .attach('file', cleanPng, 'bill.png');
    expect(dup.status).toBe(200);
    expect(dup.body).toEqual({ status: 'already_received', documentId: docId });
  });

  it('rejects unsupported file types', async () => {
    const r = await request(app)
      .post(`/sites/${siteA}/documents`)
      .set(auth(tokenA))
      .attach('file', Buffer.from('hello'), { filename: 'x.txt', contentType: 'text/plain' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('UNSUPPORTED_FILE');
  });

  it('shows the extracted fields with a signed file URL', async () => {
    const r = await waitForStatus(docId, 'extracted');
    expect(r.body.fields).toMatchObject({
      consumerNo: expected.consumer_no,
      billNo: expected.bill_no,
      periodStart: expected.period_start,
      periodEnd: expected.period_end,
      kwh: expected.kwh,
      kvah: expected.kvah,
      pf: expected.pf,
      mdKva: expected.md_kva,
      peakKwh: expected.tod_peak_kwh,
      energyCharges: expected.energy_charges,
      demandCharges: expected.demand_charges,
      total: expected.total,
    });
    expect(r.body.lowConfidence).toEqual([]);
    expect(r.body.validation.errors).toEqual([]);
    expect(r.body.fileUrl).toMatch(/^https?:\/\//);
  });

  it('rejects a confirm whose edited fields fail validation (422)', async () => {
    const r = await request(app)
      .post(`/documents/${docId}/confirm`)
      .set(auth(tokenA))
      .send({ fields: { ...expected_fields(), kwh: 120000 }, productionTonnes: 100 });
    expect(r.status).toBe(422);
    expect(r.body.code).toBe('VALIDATION_FAILED');
  });

  it('confirms with 100 t and 1200 L diesel and saves a footprint result', async () => {
    const doc = await request(app).get(`/documents/${docId}`).set(auth(tokenA));
    const r = await request(app)
      .post(`/documents/${docId}/confirm`)
      .set(auth(tokenA))
      .send({ fields: doc.body.fields, productionTonnes: 100, dieselLitres: 1200 });
    expect(r.status).toBe(200);
    resultId = r.body.resultId;
    const row = await prisma.result.findUniqueOrThrow({ where: { id: resultId } });
    const want = ((92000 / 1000) * 0.675 + (1200 * 2.675) / 1000) / 100;
    expect(Number(row.intensity)).toBeCloseTo(want, 3); // 0.65310
    expect(row.factorIds).toHaveLength(2);
    expect((await request(app).get(`/documents/${docId}`).set(auth(tokenA))).body.status).toBe(
      'confirmed',
    );
    const again = await request(app)
      .post(`/documents/${docId}/confirm`)
      .set(auth(tokenA))
      .send({ fields: doc.body.fields, productionTonnes: 100 });
    expect(again.status).toBe(409);
  });

  it('explains the result with 2 versioned factors', async () => {
    const r = await request(app).get(`/results/${resultId}/explain`).set(auth(tokenA));
    expect(r.status).toBe(200);
    expect(r.body.factors).toHaveLength(2);
    const byType = Object.fromEntries(
      r.body.factors.map((f: { sourceType: string }) => [f.sourceType, f]),
    );
    // Oct 2026 bill: CEA v22.0 FY 2025-26 (latest FY published), not the FY 2023-24 v20.0 row.
    expect(byType.grid_electricity_india.version).toBe('v22.0');
    expect(byType.grid_electricity_india.value).toBe(0.675);
    expect(byType.grid_electricity_india.gasBasis).toBe('CO2');
    expect(byType.diesel_litre.gasBasis).toBe('CO2e');
    expect(r.body.inputs.map((i: { kind: string }) => i.kind).sort()).toEqual([
      'kwh',
      'litres',
      'tonnes',
    ]);
    expect(r.body.formulaVersion).toBeTruthy();
  });

  it('lists confirmed months with rupees first', async () => {
    const r = await request(app).get(`/sites/${siteA}/months`).set(auth(tokenA));
    expect(r.status).toBe(200);
    expect(r.body[0].month).toBe('2026-10-01');
    expect(r.body[0].rupees.total).toBe(765000 + 200000); // energy + demand charges
    expect(r.body[0].co2.label).toBe('t CO2 (grid) + t CO2e (fuels)');
  });

  it("hides another org's documents, results and sites (404)", async () => {
    const m = await request(app)
      .post(`/sites/${siteB}/documents/manual`)
      .set(auth(tokenB))
      .send({
        fields: manualFields({
          billNo: 'B-2027-04',
          periodStart: '2027-04-01',
          periodEnd: '2027-04-30',
        }),
      });
    expect(m.status).toBe(201);
    expect(
      (await request(app).get(`/documents/${m.body.documentId}`).set(auth(tokenB))).status,
    ).toBe(200);
    expect(
      (await request(app).get(`/documents/${m.body.documentId}`).set(auth(tokenA))).status,
    ).toBe(404);
    expect((await request(app).get(`/results/${resultId}/explain`).set(auth(tokenB))).status).toBe(
      404,
    );
    expect((await request(app).get(`/sites/${siteB}/months`).set(auth(tokenA))).status).toBe(404);
  });

  it('supports manual entry end to end', async () => {
    const m = await request(app)
      .post(`/sites/${siteA}/documents/manual`)
      .set(auth(tokenA))
      .send({ fields: manualFields() });
    expect(m.status).toBe(201);
    const doc = await request(app).get(`/documents/${m.body.documentId}`).set(auth(tokenA));
    expect(doc.body.status).toBe('extracted');
    expect(doc.body.fields.kwh).toBe(90000);
    expect(doc.body.fields.energyCharges).toBe(742050);
    expect(doc.body.fileUrl).toBeNull();
    const c = await request(app)
      .post(`/documents/${m.body.documentId}/confirm`)
      .set(auth(tokenA))
      .send({ fields: doc.body.fields, productionTonnes: 95 });
    expect(c.status).toBe(200);
    expect(c.body.resultId).toBeTruthy();
  });

  it('reports consent status and the latest document for a site', async () => {
    const cs = await request(app).get('/consents/status').set(auth(tokenA));
    expect(cs.status).toBe(200);
    expect(cs.body.processing).toBe(true);
    expect(typeof cs.body.noticeVersion).toBe('string');
    expect((await request(app).get('/consents/status')).status).toBe(401);

    const latest = await request(app).get(`/sites/${siteA}/documents/latest`).set(auth(tokenA));
    expect(latest.status).toBe(200);
    expect(latest.body.id).toBeTruthy();
    expect(latest.body.status).toBeTruthy();
    // another org's site is a 404, and a missing token a 401
    expect(
      (await request(app).get(`/sites/${siteB}/documents/latest`).set(auth(tokenA))).status,
    ).toBe(404);
    expect((await request(app).get(`/sites/${siteA}/documents/latest`)).status).toBe(401);
  });
});

function expected_fields() {
  return {
    consumerNo: expected.consumer_no,
    billNo: expected.bill_no,
    periodStart: expected.period_start,
    periodEnd: expected.period_end,
    kwh: expected.kwh,
    kvah: expected.kvah,
    pf: expected.pf,
    mdKva: expected.md_kva,
    contractedDemandKva: expected.contracted_demand_kva,
    peakKwh: expected.tod_peak_kwh,
    energyCharges: expected.energy_charges,
    demandCharges: expected.demand_charges,
    otherCharges: expected.other_charges,
    total: expected.total,
  };
}
