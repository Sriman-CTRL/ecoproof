import { SAMPLE_GSTIN } from '@ecoproof/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { DEMOS } from '../src/demo/ids.js';
import { resetDemo, seedDemo } from '../prisma/demo/seed-demo.js';

const app = createApp();
let tokenA = '';
let tokenB = '';
let siteA = '';
let siteB = '';
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const byCode = (checks: Array<{ code: string; result: string }>) =>
  Object.fromEntries(checks.map((c) => [c.code, c.result]));

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

describe('D89 onboarding and business check', () => {
  it('Demo A starts not finished; Demo B has its own consumer number', async () => {
    const r = await request(app).get(`/sites/${siteA}/onboarding`).set(auth(tokenA));
    expect(r.status).toBe(200);
    expect(r.body.done).toBe(false);
    expect(r.body.samples.dieselLitres).toBe(1200);
    const b = await prisma.site.findFirst({ where: { id: siteB } });
    expect(b?.consumerNo).toBe('SAMPLE-HT-0002');
  });

  it('typed numbers -> Self-declared; the sample certificate -> Matched to documents', async () => {
    const t = await request(app)
      .post(`/sites/${siteA}/business-check`)
      .set(auth(tokenA))
      .send({ udyamNo: 'UDYAM-SAMPLE-0001', gstin: SAMPLE_GSTIN, consumerNo: 'SAMPLE-HT-0001' });
    expect(t.status).toBe(200);
    expect(t.body.level).toBe('self_declared');
    expect(t.body.checks[0].line).toBe('Sample number (demo).');
    const d = await request(app)
      .post(`/sites/${siteA}/business-check/udyam-certificate`)
      .set(auth(tokenA))
      .send({ sample: true });
    expect(d.status).toBe(200);
    expect(d.body.levelText).toBe('Matched to documents');
    expect(byCode(d.body.checks)).toMatchObject({
      udyam_match: 'pass',
      name_match: 'pass',
      state_match: 'pass',
      pan_match: 'cant_check',
      manufacturing: 'pass',
      meter_unique: 'pass',
    });
    const row = await prisma.businessCheck.findUnique({ where: { orgId: DEMOS.A.orgId } });
    expect(JSON.stringify(row)).not.toMatch(/AAAAA0000A"|aadhaar|pan"/i);
  });

  it("another business can't take Demo A's consumer number", async () => {
    const r = await request(app)
      .post(`/sites/${siteB}/business-check`)
      .set(auth(tokenB))
      .send({ udyamNo: 'UDYAM-SAMPLE-0001', consumerNo: 'SAMPLE-HT-0001' });
    expect(byCode(r.body.checks).meter_unique).toBe('flag');
    expect(r.body.level).toBe('none');
    const b = await prisma.site.findFirst({ where: { id: siteB } });
    expect(b?.consumerNo).toBe('SAMPLE-HT-0002');
  });

  it('a bad GSTIN is flagged with its reason', async () => {
    const bad = SAMPLE_GSTIN.slice(0, 14) + (SAMPLE_GSTIN.endsWith('A') ? 'B' : 'A');
    const r = await request(app)
      .post(`/sites/${siteB}/business-check`)
      .set(auth(tokenB))
      .send({ udyamNo: 'UDYAM-TS-02-0012345', gstin: bad, consumerNo: 'SAMPLE-HT-0002' });
    expect(byCode(r.body.checks).gstin_format).toBe('flag');
  });
});

describe('D89 bill checks, lock and history', () => {
  let clean = '';
  let edited = '';
  it('the sample bill passes; the edited bill does not add up', async () => {
    const c = await request(app)
      .post(`/sites/${siteA}/documents/sample`)
      .set(auth(tokenA))
      .send({ variant: 'clean' });
    expect(c.status).toBe(201);
    clean = c.body.documentId;
    const e = await request(app)
      .post(`/sites/${siteA}/documents/sample`)
      .set(auth(tokenA))
      .send({ variant: 'edited' });
    edited = e.body.documentId;
    const again = await request(app)
      .post(`/sites/${siteA}/documents/sample`)
      .set(auth(tokenA))
      .send({ variant: 'edited' });
    expect(again.body).toMatchObject({ status: 'already_received', documentId: edited });

    const cc = await request(app).get(`/documents/${clean}/checks?tonnes=105`).set(auth(tokenA));
    expect(cc.status).toBe(200);
    expect(cc.body.checks.filter((x: { result: string }) => x.result === 'flag')).toEqual([]);
    expect(byCode(cc.body.checks)).toMatchObject({
      A1: 'pass',
      A4: 'pass',
      B1: 'pass',
      C1: 'pass',
    });

    const ec = await request(app).get(`/documents/${edited}/checks?tonnes=105`).set(auth(tokenA));
    expect(byCode(ec.body.checks)).toMatchObject({ A1: 'flag', A4: 'flag', C1: 'flag' });
    expect(ec.body.checks[0].line).toMatch(/don't add up/);
    expect(ec.body.sourceText).toBe('Sample edited bill (demo)');
    expect(ec.body.strength).toBe('second_look');
    expect(JSON.stringify(ec.body)).not.toMatch(/fraud|fake/i);
  });

  it('another org gets 404 on documents, months and business check', async () => {
    expect((await request(app).get(`/documents/${clean}/checks`).set(auth(tokenB))).status).toBe(
      404,
    );
    expect((await request(app).post(`/documents/${clean}/discard`).set(auth(tokenB))).status).toBe(
      404,
    );
    expect((await request(app).get(`/sites/${siteA}/data-months`).set(auth(tokenB))).status).toBe(
      404,
    );
    expect((await request(app).get(`/sites/${siteA}/onboarding`).set(auth(tokenB))).status).toBe(
      404,
    );
    expect(
      (await request(app).get(`/sites/${siteA}/business-check`).set(auth(tokenB))).status,
    ).toBe(404);
  });

  it('confirm, lock, PATCH 409, correction with reason, history', async () => {
    expect((await request(app).post(`/documents/${edited}/discard`).set(auth(tokenA))).status).toBe(
      200,
    );
    const doc = await request(app).get(`/documents/${clean}`).set(auth(tokenA));
    const conf = await request(app).post(`/documents/${clean}/confirm`).set(auth(tokenA)).send({
      fields: doc.body.fields,
      productionTonnes: 105,
      dieselLitres: 1200,
      acknowledged: doc.body.validation.needsConfirmation,
    });
    expect(conf.status).toBe(200);

    const months = await request(app).get(`/sites/${siteA}/data-months`).set(auth(tokenA));
    expect(months.status).toBe(200);
    const oct = months.body.months[0];
    expect(oct.month).toBe('2026-10-01');
    expect(oct.strengthText).toBe('From DISCOM PDF, checks passed');
    expect(oct.fileSha256).toMatch(/^[0-9a-f]{64}$/);

    const id = oct.id;
    expect((await request(app).post(`/energy-months/${id}/lock`).set(auth(tokenB))).status).toBe(
      404,
    );
    const lock = await request(app).post(`/energy-months/${id}/lock`).set(auth(tokenA)).send({});
    expect(lock.status).toBe(200);
    const patch = await request(app)
      .patch(`/energy-months/${id}`)
      .set(auth(tokenA))
      .send({ kwh: 1 });
    expect(patch.status).toBe(409);

    const noReason = await request(app)
      .post(`/energy-months/${id}/corrections`)
      .set(auth(tokenA))
      .send({ values: { kwh: 91000 } });
    expect(noReason.status).toBe(400);
    const corr = await request(app)
      .post(`/energy-months/${id}/corrections`)
      .set(auth(tokenA))
      .send({ values: { kwh: 91000 }, reason: 'typing mistake' });
    expect(corr.status).toBe(201);
    expect(corr.body.version).toBe(2);

    const h = await request(app).get(`/energy-months/${id}/history`).set(auth(tokenA));
    expect(h.body.versions.map((v: { version: number }) => v.version)).toEqual([1, 2]);
    expect(h.body.versions[0].values.kwh).toBe(92000);
    expect(h.body.versions[1]).toMatchObject({ reason: 'typing mistake' });
    expect((await request(app).get(`/energy-months/${id}/history`).set(auth(tokenB))).status).toBe(
      404,
    );
  });

  it('a month that needs a second look locks only with a reason', async () => {
    const m = await prisma.energyMonth.findFirst({
      // Sep 2026: inside FY 2026-27, so the tariff recompute (A1) applies.
      where: { orgId: DEMOS.A.orgId, lockedAt: null },
      orderBy: { periodStart: 'desc' },
    });
    await prisma.energyMonth.update({ where: { id: m!.id }, data: { energyCharges: 1 } });
    const r = await request(app).post(`/energy-months/${m!.id}/lock`).set(auth(tokenA)).send({});
    expect(r.status).toBe(422);
    const ok = await request(app)
      .post(`/energy-months/${m!.id}/lock`)
      .set(auth(tokenA))
      .send({ reason: 'DISCOM printed a credit this month' });
    expect(ok.status).toBe(200);
  });

  it('finish marks onboarding done; demo reset sets it back', async () => {
    await request(app).post(`/sites/${siteA}/onboarding/finish`).set(auth(tokenA));
    const login = await request(app).post('/auth/demo-login').send({ demo: 'A' });
    expect(login.body.org.onboardingDoneAt).not.toBeNull();
    await resetDemo();
    await seedDemo();
    const after = await request(app).post('/auth/demo-login').send({ demo: 'A' });
    expect(after.body.org.onboardingDoneAt).toBeNull();
    expect(await prisma.businessCheck.count({ where: { orgId: DEMOS.A.orgId } })).toBe(0);
    expect(await prisma.energyMonthVersion.count({ where: { orgId: DEMOS.A.orgId } })).toBe(0);
  });
});
