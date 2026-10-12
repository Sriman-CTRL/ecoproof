import { readFileSync } from 'node:fs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { resetDemo, seedDemo } from '../prisma/demo/seed-demo.js';

const app = createApp();
const bills = new URL('../prisma/demo/bills/', import.meta.url);
const cleanPng = readFileSync(new URL('bill-2026-10-clean.png', bills));

let tokenA = '';
let tokenB = '';
let siteA = '';
let siteB = '';
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

interface Progress {
  stage: number;
  stageName: string | null;
  stages: Array<{ n: number; key: string; reached: boolean; reachedAt: string | null }>;
  milestones: Array<{ key: string; reached: boolean; reachedAt: string | null; source: string }>;
  next: { key: string; text: string; href: string };
  headroom: {
    foundInrPerMonth: number;
    startedInrPerMonth: number;
    onTableInrPerMonth: number;
    basis: string;
  };
  ritual: {
    month: string | null;
    billReceived: boolean;
    valuesConfirmed: boolean;
    billChecked: boolean;
    actionChosen: boolean;
  };
}

const progress = async (token: string, site: string) => {
  const r = await request(app).get(`/sites/${site}/progress`).set(auth(token));
  expect(r.status).toBe(200);
  return r.body as Progress;
};

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

// Leave Demo A at exactly 12 months so the live Oct 2026 upload works on stage.
afterAll(async () => {
  await resetDemo();
  await seedDemo();
  await prisma.$disconnect();
});

describe('GET /sites/:siteId/progress', () => {
  it('Demo A before the Oct upload: Baseline set, next = the top action, nothing started', async () => {
    const p = await progress(tokenA, siteA);
    expect(p.stage).toBe(2);
    expect(p.stageName).toBe('Baseline set');
    const actions = await request(app).get(`/sites/${siteA}/actions`).set(auth(tokenA));
    expect(p.next.text).toBe(`Start: ${actions.body.actions[0].title}`);
    expect(p.next.href).toContain(`/actions/${actions.body.actions[0].code}`);
    expect(p.headroom.foundInrPerMonth).toBeGreaterThan(0);
    expect(p.headroom.startedInrPerMonth).toBe(0);
    expect(p.headroom.onTableInrPerMonth).toBe(p.headroom.foundInrPerMonth);
    expect(p.ritual).toMatchObject({
      month: '2026-09',
      billReceived: true,
      valuesConfirmed: true,
      billChecked: true,
      actionChosen: false,
    });
    for (const m of p.milestones) expect(m.reached).toBe(m.reachedAt != null);
  });

  it('Demo A after confirming Oct 2026 and planning fix_power_factor: Rs 61,200 started', async () => {
    const up = await request(app)
      .post(`/sites/${siteA}/documents`)
      .set(auth(tokenA))
      .attach('file', cleanPng, 'bill.png');
    const docId = up.body.documentId as string;
    let confirmed = false;
    for (let i = 0; i < 60 && !confirmed; i++) {
      const d = await request(app).get(`/documents/${docId}`).set(auth(tokenA));
      if (d.body.status === 'extracted') {
        // Read but not confirmed yet: received, values not confirmed.
        const mid = await progress(tokenA, siteA);
        expect(mid.ritual).toMatchObject({
          month: '2026-10',
          billReceived: true,
          valuesConfirmed: false,
        });
        const c = await request(app)
          .post(`/documents/${docId}/confirm`)
          .set(auth(tokenA))
          .send({ fields: d.body.fields, productionTonnes: 100, dieselLitres: 1200 });
        expect(c.status).toBe(200);
        confirmed = true;
      } else {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    expect(confirmed).toBe(true);
    const plan = await request(app)
      .post(`/sites/${siteA}/actions/fix_power_factor/plan`)
      .set(auth(tokenA))
      .send({ status: 'planned' });
    expect(plan.status).toBe(200);

    const p = await progress(tokenA, siteA);
    expect(p.headroom.startedInrPerMonth).toBe(61200);
    expect(p.headroom.onTableInrPerMonth).toBe(p.headroom.foundInrPerMonth - 61200);
    expect(p.ritual).toMatchObject({
      month: '2026-10',
      billReceived: true,
      valuesConfirmed: true,
      billChecked: true,
      actionChosen: true,
    });
  });

  it('Demo B: the stage its own rows support, every reached milestone dated', async () => {
    const t0 = performance.now();
    const p = await progress(tokenB, siteB);
    const ms = Math.round(performance.now() - t0);
    console.log(
      `Demo B progress (${ms} ms): stage ${p.stage} ${p.stageName}; next "${p.next.text}"; ` +
        `headroom ${JSON.stringify(p.headroom)}; milestones ` +
        p.milestones.map((m) => `${m.key}=${m.reachedAt ?? 'no'}`).join(', '),
    );
    for (const m of p.milestones) expect(m.reached).toBe(m.reachedAt != null);
    for (const s of p.stages) expect(s.reached).toBe(s.n <= p.stage);
    const byKey = Object.fromEntries(p.milestones.map((m) => [m.key, m]));
    expect(byKey.loan_pack_sent!.reached).toBe(true);
    expect(byKey.buyer_approved).toMatchObject({ reached: false, source: 'not built yet' });
    expect(p.stage).toBeGreaterThanOrEqual(2);
  });

  it('is org-scoped: Demo A token on Demo B progress -> 404', async () => {
    const r = await request(app).get(`/sites/${siteB}/progress`).set(auth(tokenA));
    expect(r.status).toBe(404);
  });
});
