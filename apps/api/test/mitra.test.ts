import { findMitraBanned } from '@ecoproof/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { storage } from '../src/adapters/storage.js';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { DEMO_ORG_IDS, ORG_A } from '../src/demo/ids.js';
import {
  QUOTES,
  renderCertificateHtml,
  renderRequestPackHtml,
  type CertificateResults,
  type RequestPackResults,
} from '../src/reports/mitraDocs.js';
import { followUpDue, NOT_PART_LINE, orderItems } from '../src/services/mitra.js';
import { resetDemo, seedDemo } from '../prisma/demo/seed-demo.js';

const app = createApp();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

let tokenA = '';
let tokenB = '';
let siteA = '';

/** Mitra steps are never seeded: clear any left by this file (demo orgs only). */
async function clearDemoSteps() {
  await prisma.mitraStep.deleteMany({ where: { orgId: { in: DEMO_ORG_IDS } } });
  await prisma.organisation.update({
    where: { id: ORG_A },
    data: { womenOwned: false, scStOwned: false },
  });
}

beforeAll(async () => {
  const a = await request(app).post('/auth/demo-login').send({ demo: 'A' });
  tokenA = a.body.token;
  siteA = a.body.site.id;
  const b = await request(app).post('/auth/demo-login').send({ demo: 'B' });
  tokenB = b.body.token;
  await clearDemoSteps();
});

afterAll(async () => {
  await clearDemoSteps();
  await prisma.$disconnect();
});

describe('Mitra wording', () => {
  it('seeded items, peer cases and the page line pass the Mitra wording scan', async () => {
    const items = await prisma.mitraItem.findMany();
    expect(items).toHaveLength(10);
    const cases = await prisma.peerCase.findMany();
    expect(cases.map((c) => c.company).sort()).toEqual([
      'K & K Foundry Pvt. Ltd',
      'Marvelous Metals Pvt Ltd',
    ]);
    const hits = [
      ...items.flatMap((i) =>
        [i.title, i.runBy, i.freeHelp, i.businessGain, i.carbonLine ?? '', i.howToStart].flatMap(
          (s) => findMitraBanned(s).map((w) => `${i.code}: ${w}`),
        ),
      ),
      ...cases.flatMap((c) =>
        [c.company, c.measure, c.investmentText, c.savingText ?? '', c.paybackText].flatMap((s) =>
          findMitraBanned(s).map((w) => `${c.code}: ${w}`),
        ),
      ),
      ...findMitraBanned(NOT_PART_LINE),
    ];
    expect(hits).toEqual([]);
  });

  it('the Mitra scan catches programme-membership and duty words', () => {
    expect(findMitraBanned('Our partner programme')).toEqual(['partner']);
    expect(findMitraBanned('This is mandatory; you must apply')).toEqual(['mandatory', 'you must']);
    expect(findMitraBanned('Certificate of Participation')).toEqual([]);
    expect(findMitraBanned('A certificate for your emissions')).toEqual(['certificate']);
    const q = 'CII is knowledge partner';
    expect(findMitraBanned(`Source: “${q}”`, [q])).toEqual([]);
  });
});

describe('Mitra API', () => {
  it('lists the Govt page with the next free step first by kind', async () => {
    const res = await request(app).get(`/sites/${siteA}/mitra?page=govt`).set(auth(tokenA));
    expect(res.status).toBe(200);
    const codes = res.body.items.map((i: { code: string }) => i.code);
    expect(codes).toEqual(
      expect.arrayContaining(['zed_pledge', 'tg_ramp_assessment', 'tg_ramp_workshop']),
    );
    expect(codes).not.toContain('sme_climate_commitment');
    expect(res.body.nextStep.code).toBe('zed_pledge');
    expect(res.body.doneCount).toBe(0);
    expect(res.body.totalCount).toBe(codes.length);
    expect(res.body.zed.rewardInr).toBe(10000);
    expect(res.body.notPartLine).toBe(NOT_PART_LINE);
  });

  it('orders commitment and links before hand-offs, visits and reading', () => {
    const sorted = orderItems([
      { kind: 'learn', sortOrder: 1 },
      { kind: 'visit', sortOrder: 2 },
      { kind: 'handoff', sortOrder: 3 },
      { kind: 'link', sortOrder: 5 },
      { kind: 'commitment', sortOrder: 4 },
    ]);
    expect(sorted.map((s) => s.kind)).toEqual(['commitment', 'link', 'handoff', 'visit', 'learn']);
  });

  it('commitment: half of the latest 12-month total, ten years after the baseline', async () => {
    const res = await request(app).get(`/sites/${siteA}/mitra?page=ngo`).set(auth(tokenA));
    expect(res.status).toBe(200);
    const c = res.body.commitment;
    expect(c.baselineT).toBeGreaterThan(0);
    expect(c.halfT).toBe(c.baselineT / 2);
    expect(c.targetYear).toBe(Number(c.periodTo.slice(0, 4)) + 10);
    expect(c.madeAt).toBeNull();
    expect(res.body.peerCases).toHaveLength(2);
  });

  it('a "both" step has the same status on both pages', async () => {
    const s = await request(app)
      .post(`/sites/${siteA}/mitra/tg_ramp_workshop/start`)
      .set(auth(tokenA));
    expect(s.status).toBe(200);
    expect(s.body.status).toBe('started');
    const [ngo, govt] = await Promise.all(
      ['ngo', 'govt'].map((p) =>
        request(app).get(`/sites/${siteA}/mitra?page=${p}`).set(auth(tokenA)),
      ),
    );
    const pick = (b: { items: Array<{ code: string; status: string }> }) =>
      b.items.find((i) => i.code === 'tg_ramp_workshop')!.status;
    expect(pick(ngo.body)).toBe('started');
    expect(pick(govt.body)).toBe('started');

    const d = await request(app)
      .post(`/sites/${siteA}/mitra/tg_ramp_workshop/done`)
      .set(auth(tokenA));
    expect(d.body.status).toBe('done_self');
    const sum = await request(app).get(`/sites/${siteA}/mitra/summary`).set(auth(tokenA));
    expect(sum.body.ngo.done).toBe(1);
    expect(sum.body.govt.done).toBe(1);
    // A later "start" never downgrades a done step.
    const again = await request(app)
      .post(`/sites/${siteA}/mitra/tg_ramp_workshop/start`)
      .set(auth(tokenA));
    expect(again.body.status).toBe('done_self');
  });

  it('another org gets 404 on the page, summary, start and done', async () => {
    for (const r of [
      request(app).get(`/sites/${siteA}/mitra?page=ngo`),
      request(app).get(`/sites/${siteA}/mitra/summary`),
      request(app).post(`/sites/${siteA}/mitra/zed_pledge/start`),
      request(app).post(`/sites/${siteA}/mitra/zed_pledge/done`),
    ]) {
      expect((await r.set(auth(tokenB))).status).toBe(404);
    }
  });

  it('peer cases by action: the IGBT case for igbt_furnace only', async () => {
    const res = await request(app).get('/peer-cases?actionCode=igbt_furnace').set(auth(tokenA));
    expect(res.status).toBe(200);
    expect(res.body.map((p: { company: string }) => p.company)).toEqual([
      'Marvelous Metals Pvt Ltd',
    ]);
    expect(res.body[0].quotedLine).toBe(
      'with an investment of INR 27.75 lakhs, and a payback period of 25 months',
    );
  });

  it('unknown step is 404 and a bad page is 400', async () => {
    const u = await request(app).post(`/sites/${siteA}/mitra/nope/start`).set(auth(tokenA));
    expect(u.status).toBe(404);
    const p = await request(app).get(`/sites/${siteA}/mitra?page=x`).set(auth(tokenA));
    expect(p.status).toBe(400);
  });

  it('woman-owned flips the ZED subsidy line to 100%', async () => {
    const on = await request(app)
      .patch('/org/profile')
      .set(auth(tokenA))
      .send({ womenOwned: true });
    expect(on.status).toBe(200);
    const g = await request(app).get(`/sites/${siteA}/mitra?page=govt`).set(auth(tokenA));
    expect(g.body.zed.womenOwned).toBe(true);
    expect(g.body.zed.subsidyPct).toBe(100);
    expect(g.body.zed.womenOwnedLine).toMatch(/^100% subsidy on the cost of ZED certification/);
    await request(app).patch('/org/profile').set(auth(tokenA)).send({ womenOwned: false });
    const g2 = await request(app).get(`/sites/${siteA}/mitra?page=govt`).set(auth(tokenA));
    expect(g2.body.zed.womenOwned).toBe(false);
    expect(g2.body.zed.subsidyPct).not.toBe(100);
  });
});

describe('follow-up check-ins', () => {
  const day = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 24 * 60 * 60 * 1000);
  it('shows from day 7 for a week, then at 30, 90 and 180 days', () => {
    const start = day(0);
    const due = Array.from({ length: 200 }, (_, n) => (followUpDue(start, day(n)) ? n : -1)).filter(
      (n) => n >= 0,
    );
    expect(due.slice(0, 7)).toEqual([7, 8, 9, 10, 11, 12, 13]);
    expect(due).toContain(30);
    expect(due).toContain(90);
    expect(due).toContain(180);
    expect(due).not.toContain(6);
    expect(due).not.toContain(14);
    expect(due).toHaveLength(28);
  });
});

const text = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
const quoteTexts = Object.values(QUOTES).map((q) => q.text);

describe('request pack and Certificate of Participation', () => {
  let packId = '';
  let certId = '';
  let proofKey = '';

  it('starting the RAMP hand-off builds the request pack and the mailto text', async () => {
    const res = await request(app)
      .post(`/sites/${siteA}/mitra/tg_ramp_assessment/start`)
      .set(auth(tokenA));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('started');
    const p = res.body.requestPack;
    packId = p.reportId;
    expect(p.email).toBe('cmanager-rich@telangana.gov.in');
    expect(p.subject).toBe(
      `Request: greening consultation and carbon footprint assessment, ${p.businessName}`,
    );
    expect(p.body.split('\n')).toHaveLength(4);
    expect(p.body).toContain(p.verifyUrl);
    expect(p.body).toMatch(/t CO2 \(.* t from grid electricity/);
    expect(p.body).not.toContain('(fuels)');
    expect(findMitraBanned(`${p.subject}\n${p.body}`)).toEqual([]);

    const report = await prisma.report.findFirst({
      where: { id: packId, orgId: ORG_A },
      include: { snapshot: true },
    });
    expect(report?.type).toBe('request_pack');
    const r = report!.snapshot.resultsJson as unknown as RequestPackResults;
    expect(r.topActions.length).toBeGreaterThan(0);
    const html = await renderRequestPackHtml(r);
    expect(html).toContain('EcoProof is not part of this programme.');
    expect(findMitraBanned(text(html))).toEqual([]);

    // A second start reuses the same pack.
    const again = await request(app)
      .post(`/sites/${siteA}/mitra/tg_ramp_assessment/start`)
      .set(auth(tokenA));
    expect(again.body.requestPack.reportId).toBe(packId);
  });

  it('done_self never gets a certificate (403)', async () => {
    await request(app).post(`/sites/${siteA}/mitra/bee_sidhiee/done`).set(auth(tokenA));
    const res = await request(app)
      .post(`/sites/${siteA}/mitra/bee_sidhiee/certificate`)
      .set(auth(tokenA));
    expect(res.status).toBe(403);
    const none = await request(app)
      .post(`/sites/${siteA}/mitra/zed_pledge/certificate`)
      .set(auth(tokenA));
    expect(none.status).toBe(403);
  });

  it('proof before start is refused', async () => {
    const res = await request(app)
      .post(`/sites/${siteA}/mitra/wri_india_training/proof`)
      .set(auth(tokenA))
      .send({ sample: true });
    expect(res.status).toBe(409);
  });

  it('sample proof confirms the step and issues a sealed Certificate of Participation', async () => {
    await request(app).post(`/sites/${siteA}/mitra/cbit_student_visit/start`).set(auth(tokenA));
    const res = await request(app)
      .post(`/sites/${siteA}/mitra/cbit_student_visit/proof`)
      .set(auth(tokenA))
      .send({ sample: true });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('confirmed');
    expect(res.body.proofType).toBe('sample');
    certId = res.body.certificate.reportId;
    expect(res.body.certificateReportId).toBe(certId);

    const report = await prisma.report.findFirst({
      where: { id: certId, orgId: ORG_A },
      include: { snapshot: true },
    });
    expect(report?.type).toBe('participation_certificate');
    const pdf = await storage.get(report!.fileKey);
    expect(createHash('sha256').update(pdf).digest('hex')).toBe(report!.sha256);
    expect(res.body.certificate.sha256).toBe(report!.sha256);

    const r = report!.snapshot.resultsJson as unknown as CertificateResults;
    expect(r.isSample).toBe(true);
    expect(r.evidence).toMatch(
      /^Confirmed by: Sample proof \(demo mode\) uploaded by the owner on /,
    );
    expect(r.quotes.map((q) => q.text)).toEqual([QUOTES.sdg13.text, QUOTES.sdg133.text]);
    const html = await renderCertificateHtml(r);
    expect(html).toContain('<div class="watermark">SAMPLE</div>');
    expect(html).toContain('Certificate of Participation');
    expect(html).toContain('t from grid electricity');
    expect(html).not.toContain('(fuels)');
    expect(findMitraBanned(text(html), quoteTexts)).toEqual([]);
    expect(findMitraBanned(r.footer)).toEqual([]);

    const step = await prisma.mitraStep.findFirst({
      where: { orgId: ORG_A, itemCode: 'cbit_student_visit' },
    });
    proofKey = step!.proofFileKey!;
    const proof = await request(app)
      .get(`/sites/${siteA}/mitra/cbit_student_visit/proof`)
      .set(auth(tokenA));
    expect(proof.status).toBe(200);
    expect(proof.body.downloadUrl).toMatch(/^https?:/);

    // Public verify shows only the participation headline.
    const v = await request(app).get(`/public/reports/${certId}/verify`);
    expect(v.body.headline.kind).toBe('participation_certificate');
    expect(v.body.headline.stepTitle).toBe('Free visit by the CBIT student team');
  });

  it('another org gets 404 on the proof file, the certificate and the report', async () => {
    for (const r of [
      request(app).get(`/sites/${siteA}/mitra/cbit_student_visit/proof`),
      request(app).post(`/sites/${siteA}/mitra/cbit_student_visit/certificate`),
      request(app).post(`/sites/${siteA}/mitra/cbit_student_visit/proof`).send({ sample: true }),
      request(app).get(`/reports/${certId}`),
    ]) {
      expect((await r.set(auth(tokenB))).status).toBe(404);
    }
  });

  it('demo reset clears Mitra steps, proof files and Mitra reports', async () => {
    await resetDemo();
    expect(await prisma.mitraStep.count({ where: { orgId: { in: DEMO_ORG_IDS } } })).toBe(0);
    expect(
      await prisma.report.count({
        where: { id: { in: [packId, certId] } },
      }),
    ).toBe(0);
    await expect(storage.get(proofKey)).rejects.toThrow();
    await seedDemo();
  }, 240_000);
});
