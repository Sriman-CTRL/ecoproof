import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { storage } from '../src/adapters/storage.js';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import {
  footerTemplate,
  LENDER_LINE,
  renderHtml,
  verifyUrlFor,
  type LoanPackResults,
} from '../src/reports/loanPack.js';
import { DEMO_REPORT_ID } from '../src/demo/ids.js';
import { pdfRenderer } from '../src/reports/pdfRenderer.js';
import { resetDemo, seedDemo } from '../prisma/demo/seed-demo.js';

const app = createApp();
const cleanPng = readFileSync(
  new URL('../prisma/demo/bills/bill-2026-10-clean.png', import.meta.url),
);
const BANNED = /approved|sanctioned|eligible|audit/i;
const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const pageCount = (pdf: Buffer) =>
  (pdf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) ?? []).length;

let tokenA = '';
let tokenB = '';
let siteA = '';
let siteB = '';
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

const LOAN_PACK = {
  actionCode: 'fix_power_factor',
  quote: { vendorName: 'Sample Capacitors (synthetic)', amountInr: 250000 },
  loan: { amountInr: 1000000, ratePct: 8, tenureMonths: 60 },
  language: 'en',
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

  const up = await request(app)
    .post(`/sites/${siteA}/documents`)
    .set(auth(tokenA))
    .attach('file', cleanPng, 'bill.png');
  const docId = up.body.documentId as string;
  for (let i = 0; i < 60; i++) {
    const d = await request(app).get(`/documents/${docId}`).set(auth(tokenA));
    if (d.body.status === 'extracted') {
      const c = await request(app)
        .post(`/documents/${docId}/confirm`)
        .set(auth(tokenA))
        .send({ fields: d.body.fields, productionTonnes: 100, dieselLitres: 1200 });
      expect(c.status).toBe(200);
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('bill never extracted');
});

afterAll(async () => {
  await pdfRenderer.close();
  await resetDemo();
  await seedDemo();
  await prisma.$disconnect();
});

describe('loan-ready summary (Demo A, Oct 2026, fix_power_factor)', () => {
  let v1 = { reportId: '', sha256: '' };

  it('needs the action planned first', async () => {
    const r = await request(app)
      .post(`/sites/${siteA}/reports/loan-pack`)
      .set(auth(tokenA))
      .send(LOAN_PACK);
    expect(r.status).toBe(409);
  });

  it('makes a sealed 4-6 page PDF with the lender wording', async () => {
    const plan = await request(app)
      .post(`/sites/${siteA}/actions/fix_power_factor/plan`)
      .set(auth(tokenA))
      .send({ status: 'planned' });
    expect(plan.status).toBe(200);

    const r = await request(app)
      .post(`/sites/${siteA}/reports/loan-pack`)
      .set(auth(tokenA))
      .send(LOAN_PACK);
    expect(r.status).toBe(201);
    expect(r.body.version).toBe(1);
    expect(r.body.downloadUrl).toMatch(/^https?:\/\//);
    v1 = { reportId: r.body.reportId, sha256: r.body.sha256 };

    const row = await prisma.report.findFirstOrThrow({
      where: { id: v1.reportId },
      include: { snapshot: true },
    });
    expect(row.fileKey).toBe(`reports/${row.orgId}/${row.id}.pdf`);
    const stored = await storage.get(row.fileKey);
    expect(sha256(stored)).toBe(row.sha256);
    expect(row.sha256).toBe(v1.sha256);
    expect(stored.subarray(0, 5).toString()).toBe('%PDF-');
    const pages = pageCount(stored);
    expect(pages).toBeGreaterThanOrEqual(4);
    expect(pages).toBeLessThanOrEqual(6);

    // Snapshot holds the frozen numbers the PDF was built from.
    const s = row.snapshot.resultsJson as unknown as LoanPackResults;
    expect(s.measure.title).toBe('Fix power factor (capacitor bank)');
    expect(s.measure.savingLow).toBeCloseTo(60000, 0);
    expect(s.measure.costText).toBe('Rs 2,50,000');
    expect(s.loan.emi).toBeCloseTo(20276.39, 1);
    expect(s.carbon.note).toBe('saves rupees, not units of energy');
    expect(s.months).toHaveLength(12);
    expect(s.months.at(-1)?.documentId).toBeTruthy();
    expect(row.snapshot.factorIds.length).toBeGreaterThan(0);

    const html = await renderHtml(s, row.snapshotId);
    expect(html).toContain("Summary for the lender's own assessment");
    expect(html).toContain('energy and carbon pre-assessment');
    expect(html).toContain('Sample data (synthetic)');
    expect(html).toContain('1,00,000');
    expect(html).not.toMatch(BANNED);

    const footer = footerTemplate(row.id, verifyUrlFor(row.id));
    expect(LENDER_LINE).toBe(
      "Summary for the lender's own assessment. Not an approval or sanction.",
    );
    expect(footer).toContain(
      'Summary for the lender&#39;s own assessment. Not an approval or sanction.',
    );
    expect(footer).toContain(`/verify/${row.id}`);
    expect(footer).not.toMatch(BANNED);
  });

  it('regenerates as version 2 and version 1 still verifies', async () => {
    const r = await request(app)
      .post(`/sites/${siteA}/reports/loan-pack`)
      .set(auth(tokenA))
      .send(LOAN_PACK);
    expect(r.status).toBe(201);
    expect(r.body.version).toBe(2);
    expect(r.body.reportId).not.toBe(v1.reportId);
    const old = await request(app).get(`/public/reports/${v1.reportId}/verify`);
    expect(old.status).toBe(200);
    expect(old.body.version).toBe(1);
    expect(old.body.sha256).toBe(v1.sha256);
  });

  it('seeds a stable sample report for the landing QR that survives re-seeding', async () => {
    const check = async () => {
      const r = await request(app).get(`/public/reports/${DEMO_REPORT_ID}/verify`);
      expect(r.status).toBe(200);
      return r.body;
    };
    const before = await check();
    await seedDemo(); // re-seeding replaces the report under the same id
    const after = await check();
    expect(after.reportId).toBe(before.reportId);
    expect(JSON.stringify(after)).toMatch(/sample/i);
  });

  it('public verify returns exactly the listed keys', async () => {
    const r = await request(app).get(`/public/reports/${v1.reportId}/verify`);
    expect(r.status).toBe(200);
    expect(Object.keys(r.body).sort()).toEqual(
      ['businessName', 'headline', 'issuedAt', 'reportId', 'sha256', 'version'].sort(),
    );
    expect(Object.keys(r.body.headline).sort()).toEqual(
      ['emi', 'measure', 'monthlySavingHigh', 'monthlySavingLow', 'netMonthly'].sort(),
    );
    expect(r.body.headline.netMonthly).toBe(Math.round(60000 - 20276.39));
    const missing = await request(app).get(
      '/public/reports/00000000-0000-4000-8000-000000000000/verify',
    );
    expect(missing.status).toBe(404);
  });

  it('share links: valid logs a view, expired and revoked are 410, unknown is 404', async () => {
    const make = () =>
      request(app)
        .post(`/reports/${v1.reportId}/shares`)
        .set(auth(tokenA))
        .send({ recipientName: 'Sample Bank (synthetic)' });
    const tokenOf = (url: string) => url.split('/s/')[1]!;

    const s1 = await make();
    expect(s1.status).toBe(201);
    expect(s1.body.shareUrl).toMatch(/\/s\/[A-Za-z0-9_-]{43}$/);
    const token = tokenOf(s1.body.shareUrl);
    const stored = await prisma.share.findFirstOrThrow({ where: { id: s1.body.id } });
    expect(stored.tokenHash).not.toContain(token);

    const ok = await request(app).get(`/public/shares/${token}`);
    expect(ok.status).toBe(200);
    expect(ok.body.reportId).toBe(v1.reportId);
    expect(ok.body.downloadUrl).toMatch(/^https?:\/\//);
    await request(app).get(`/public/shares/${token}?download=1`).expect(200);
    const meta = await request(app).get(`/reports/${v1.reportId}`).set(auth(tokenA));
    const listed = meta.body.shares.find((s: { id: string }) => s.id === s1.body.id);
    expect(listed.views).toBe(1);
    expect(listed.downloads).toBe(1);
    expect(listed.recipientName).toBe('Sample Bank (synthetic)');

    const s2 = await make();
    await prisma.share.update({
      where: { id: s2.body.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    expect((await request(app).get(`/public/shares/${tokenOf(s2.body.shareUrl)}`)).status).toBe(
      410,
    );

    const s3 = await make();
    await request(app).delete(`/shares/${s3.body.id}`).set(auth(tokenA)).expect(200);
    expect((await request(app).get(`/public/shares/${tokenOf(s3.body.shareUrl)}`)).status).toBe(
      410,
    );

    expect((await request(app).get('/public/shares/not-a-real-token')).status).toBe(404);
  });

  it("keeps each org's reports and sites apart (404)", async () => {
    const other = await request(app)
      .post(`/sites/${siteB}/reports/loan-pack`)
      .set(auth(tokenA))
      .send(LOAN_PACK);
    expect(other.status).toBe(404);
    expect((await request(app).get(`/reports/${v1.reportId}`).set(auth(tokenB))).status).toBe(404);
    const share = await request(app)
      .post(`/reports/${v1.reportId}/shares`)
      .set(auth(tokenB))
      .send({ recipientName: 'x' });
    expect(share.status).toBe(404);
    const mine = await prisma.share.findFirstOrThrow({ where: { reportId: v1.reportId } });
    expect((await request(app).delete(`/shares/${mine.id}`).set(auth(tokenB))).status).toBe(404);
  });
});
