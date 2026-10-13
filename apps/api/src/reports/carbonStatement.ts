import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Site } from '@prisma/client';
import QRCode from 'qrcode';
import { z } from 'zod';
import { storage } from '../adapters/storage.js';
import { prisma } from '../db.js';
import { DEMO_ORG_IDS } from '../demo/ids.js';
import { AppError } from '../errors.js';
import { computeCarbon, type Carbon } from '../services/carbon.js';
import { SAVINGS_METHOD_NOTE } from '../services/savings.js';
import { dateText, dec, esc, fill, footerHtml, monthName, table } from './html.js';
import { verifyUrlFor } from './loanPack.js';
import { pdfRenderer } from './pdfRenderer.js';

export const CarbonStatementBody = z.object({ language: z.literal('en').default('en') });
export type CarbonStatementBody = z.infer<typeof CarbonStatementBody>;

export const CARBON_TITLE = 'Carbon footprint statement';
/** Footer line on every page (no lender wording: this is not a loan document). */
export const CARBON_FOOTER =
  "Energy and carbon pre-assessment from the owner's own bills. Not a third-party verification.";
export const STAMP_TEXT = 'VERIFIED BY YOUR BILLS';
export const CALCULATED_TEXT = 'Calculated from your bills';

export interface CarbonStatementResults {
  reportId: string;
  version: number;
  issuedAt: string;
  isSample: boolean;
  verifyUrl: string;
  business: { name: string; siteAddress: string };
  carbon: Carbon;
  factors: Array<{
    id: string;
    sourceType: string;
    value: number;
    unit: string;
    version: string | null;
    source: string;
    page: string | null;
    status: string;
  }>;
}

const sha256 = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const t2 = (n: number) => `${dec(Math.round(n * 100) / 100)} t`;

async function buildResults(
  site: Site,
  ids: { reportId: string; version: number; issuedAt: Date },
): Promise<CarbonStatementResults> {
  const org = await prisma.organisation.findFirst({ where: { id: site.orgId } });
  if (!org) throw new AppError(404, 'NOT_FOUND', 'Organisation not found');
  const carbon = await computeCarbon(site);
  const factorIds = [...new Set(carbon.factorIds)];
  const factors = await prisma.factor.findMany({ where: { id: { in: factorIds } } });
  return {
    reportId: ids.reportId,
    version: ids.version,
    issuedAt: ids.issuedAt.toISOString(),
    isSample: DEMO_ORG_IDS.includes(site.orgId),
    verifyUrl: verifyUrlFor(ids.reportId),
    business: { name: org.name, siteAddress: site.address ?? 'not given' },
    carbon,
    factors: factors.map((f) => ({
      id: f.id,
      sourceType: f.sourceType,
      value: Number(f.value),
      unit: f.unit,
      version: f.version,
      source: f.source,
      page: f.page,
      status: f.status,
    })),
  };
}

const template = readFileSync(
  new URL('./templates/carbon-statement.html', import.meta.url),
  'utf8',
);

export async function renderCarbonHtml(
  r: CarbonStatementResults,
  snapshotId: string,
): Promise<string> {
  const qrDataUrl = await QRCode.toDataURL(r.verifyUrl, { margin: 1, width: 300 });
  const c = r.carbon;
  const l = c.latestMonth;
  const first = c.months[0]!;
  const fuelsUnit = c.household ? '' : ' (fuels: t CO2e)';
  const saved = c.savedSoFar;
  // "Verified by your bills" only for months the savings check confirmed (S8a status).
  const avoidedBlock = saved
    ? saved.verifiedTco2 > 0
      ? `<h3>CO2 avoided so far</h3><p><span class="stamp">${STAMP_TEXT}</span></p><p><span class="big">${esc(t2(saved.verifiedTco2))} CO2</span> avoided over ${saved.months} months, from the electricity saved after the owner's actions.</p><p class="muted">${esc(SAVINGS_METHOD_NOTE)}</p>`
      : `<h3>CO2 avoided so far</h3><p class="label">${CALCULATED_TEXT}</p><p><span class="big">${esc(t2(saved.tco2))} CO2</span> over ${saved.months} months.</p><p class="muted">${esc(SAVINGS_METHOD_NOTE)}</p>`
    : '';
  const vars: Record<string, string> = {
    reportId: r.reportId,
    version: String(r.version),
    snapshotId,
    issuedDate: dateText(r.issuedAt),
    sampleBadge: r.isSample ? '<p><span class="badge">Sample data (synthetic)</span></p>' : '',
    businessName: r.business.name,
    siteAddress: r.business.siteAddress,
    period: `${monthName(first.month)} to ${monthName(l.month)} (${c.months.length} months)`,
    latestMonth: monthName(l.month),
    latestTotal: `${t2(l.totalT)} ${c.label}`,
    latestScope2: `${t2(l.scope2T)} CO2`,
    latestScope1: c.household ? 'none' : `${t2(l.scope1T)} CO2e`,
    latestIntensity:
      l.intensity == null
        ? 'not shown (no production figure)'
        : `${dec(l.intensity)} t per tonne of output`,
    periodTotal: `${t2(c.months.reduce((t, m) => t + m.totalT, 0))}${fuelsUnit}`,
    avoidedBlock,
    qrDataUrl,
    verifyUrl: r.verifyUrl,
    monthsTable: table(
      c.household
        ? ['Month', 'Scope 2 (t CO2)']
        : ['Month', 'Scope 1 (t CO2e)', 'Scope 2 (t CO2)', 'Total (t)', 't per tonne'],
      c.months.map((m) =>
        c.household
          ? [monthName(m.month), dec(m.scope2T)]
          : [
              monthName(m.month),
              dec(m.scope1T),
              dec(m.scope2T),
              dec(m.totalT),
              m.intensity == null ? '-' : dec(m.intensity),
            ],
      ),
      c.household ? [1] : [1, 2, 3, 4],
    ),
    methodLines: c.method.lines.map(esc).join('<br />'),
    factorsTable: table(
      ['Factor', 'Value', 'Version', 'Source', 'ID'],
      r.factors.map((f) => [
        f.sourceType,
        `${dec(f.value)} ${f.unit}`,
        f.version ?? '-',
        f.page ? `${f.source}, ${f.page}` : f.source,
        f.id.slice(0, 8),
      ]),
      [1],
    ),
    formulaVersion: c.formulaVersion,
  };
  return fill('carbon-statement', template, vars);
}

export const carbonFooter = (reportId: string) =>
  footerHtml(CARBON_FOOTER, reportId, verifyUrlFor(reportId));

/**
 * Doc 05 pipeline: snapshot, render, seal, store. A new statement is version n+1.
 * `seed.reportId` is for the demo seed only (a fixed id the pitch QR points at).
 */
export async function createCarbonStatement(
  site: Site,
  body: CarbonStatementBody,
  seed: { reportId?: string } = {},
) {
  const orgId = site.orgId;
  const previous = await prisma.report.count({
    where: { orgId, snapshot: { siteId: site.id, type: 'carbon_statement' } },
  });
  const ids = {
    reportId: seed.reportId ?? randomUUID(),
    version: previous + 1,
    issuedAt: new Date(),
  };
  const snapshotId = randomUUID();
  const results = await buildResults(site, ids);
  const html = await renderCarbonHtml(results, snapshotId);
  const pdf = await pdfRenderer.render(html, { footerTemplate: carbonFooter(ids.reportId) });
  const seal = sha256(pdf);
  const fileKey = `reports/${orgId}/${ids.reportId}.pdf`;
  await storage.put(fileKey, pdf, 'application/pdf');

  await prisma.$transaction([
    prisma.reportSnapshot.create({
      data: {
        id: snapshotId,
        orgId,
        siteId: site.id,
        type: 'carbon_statement',
        language: body.language,
        inputsJson: { request: body, factorIds: results.carbon.factorIds },
        resultsJson: results as object,
        factorIds: results.factors.map((f) => f.id),
        formulaVersion: results.carbon.formulaVersion,
        createdAt: ids.issuedAt,
      },
    }),
    prisma.report.create({
      data: {
        id: ids.reportId,
        orgId,
        snapshotId,
        type: 'carbon_statement',
        language: body.language,
        fileKey,
        sha256: seal,
        version: ids.version,
        createdAt: ids.issuedAt,
      },
    }),
  ]);
  return { reportId: ids.reportId, version: ids.version, sha256: seal, fileKey };
}
