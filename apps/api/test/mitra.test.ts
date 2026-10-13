import { findMitraBanned } from '@ecoproof/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { DEMO_ORG_IDS, ORG_A } from '../src/demo/ids.js';
import { followUpDue, NOT_PART_LINE, orderItems } from '../src/services/mitra.js';

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
