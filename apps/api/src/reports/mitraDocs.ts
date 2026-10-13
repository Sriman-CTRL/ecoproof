import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { MitraItem, MitraStep, Site } from '@prisma/client';
import QRCode from 'qrcode';
import { storage } from '../adapters/storage.js';
import { prisma } from '../db.js';
import { DEMO_ORG_IDS } from '../demo/ids.js';
import { AppError } from '../errors.js';
import { listActions } from '../services/actions.js';
import { computeCarbon } from '../services/carbon.js';
import { computeInsights, resolveMonth } from '../services/insights.js';
import { computeSchemes } from '../services/schemes.js';
import { dateText, dec, esc, fill, footerHtml, inr, monthName, table } from './html.js';
import { MEASURE_TITLE, verifyUrlFor } from './loanPack.js';
import { pdfRenderer } from './pdfRenderer.js';

/**
 * D7 Mitra documents, through the same pipeline as the carbon statement (snapshot, PDF, sha256,
 * storage, /verify QR): the request pack (prepared for the owner to send; EcoProof sends nothing)
 * and the Certificate of Participation (confirmed steps only; never certifies emissions or savings).
 */

export const REQUEST_PACK_PROGRAMME = 'Telangana RAMP greening (Green Pioneer Support Programme)';
export const REQUEST_PACK_TITLE = `Request pack for ${REQUEST_PACK_PROGRAMME}`;
export const REQUEST_PACK_CLOSING =
  "Prepared by EcoProof from the unit's own bills. EcoProof is not part of this programme.";
export const REQUEST_PACK_ASK =
  'A one-on-one greening consultation and a carbon footprint assessment for our unit, under Telangana RAMP. The figures below come from our own power bills and fuel records.';
export const MAIL_SUBJECT = (unit: string) =>
  `Request: greening consultation and carbon footprint assessment, ${unit}`;

/** RICH contact from findings-round2.md "Re-check, 13 Oct" (the owner sends; EcoProof never does). */
export const REQUEST_PACK_EMAIL = 'cmanager-rich@telangana.gov.in';

/** The four-line email body the owner sends from their own mail app. */
export function mailBody(r: RequestPackResults): string {
  const top = r.topActions[0]?.title;
  return [
    `We are ${r.business.name}. We would like to ask for a greening consultation and carbon footprint assessment under Telangana RAMP.`,
    `Our latest month (${monthName(r.latestMonth)}): ${t2(r.latestT)} ${r.label}, and ${inr(r.atStakeInr)} a month at stake on our power bill.`,
    top ? `Top action from our bills: ${top}.` : 'Top action from our bills: not found yet.',
    `Our request pack, prepared from our own bills: ${r.verifyUrl}`,
  ].join('\n');
}

export const CERT_TITLE = 'Certificate of Participation';
/** Steps run by EcoProof's own team (no outside body to disclaim). */
const OWN_TEAM_STEPS = new Set(['cbit_student_visit']);

export const certFooter = (runBy: string, code = '') =>
  OWN_TEAM_STEPS.has(code)
    ? 'Issued by EcoProof to record participation. It does not certify emissions or savings.'
    : `Issued by EcoProof to record participation. It does not certify emissions or savings, is not issued by ${runBy}, and EcoProof is not part of their programme.`;

/** Verbatim quotes allowed on the certificate (findings-round2.md "Quotes allowed"). */
export const QUOTES = {
  sdg13: {
    text: 'Take urgent action to combat climate change and its impacts.',
    source: 'UN Sustainable Development Goal 13',
    url: 'https://sdgdata.gov.uk/13',
  },
  sdg133: {
    text: 'Improve education, awareness-raising and human and institutional capacity on climate change mitigation, adaptation, impact reduction and early warning.',
    source: 'SDG target 13.3',
    url: 'https://sdgdata.gov.uk/13',
  },
  commitment: {
    text: 'Halve our greenhouse gas emissions within ten years',
    source: 'SME Climate Commitment',
    url: 'https://smeclimatehub.org/sme-climate-commitment/',
  },
  sternin: {
    text: "It's easier to act your way into a new way of thinking than to think your way into a new way of acting.",
    source: 'Monique Sternin (Save the Children, positive deviance)',
    url: 'https://frompoverty.oxfam.org.uk/?p=16533',
  },
} as const;

const LEARNING_STEPS = new Set([
  'tg_ramp_workshop',
  'wri_india_training',
  'cbit_student_visit',
  'msme_dfo_hyd',
  'tg_ramp_assessment',
]);

export function quotesFor(code: string) {
  if (code === 'sme_climate_commitment') return [QUOTES.sdg13, QUOTES.commitment];
  if (LEARNING_STEPS.has(code)) return [QUOTES.sdg13, QUOTES.sdg133];
  return [QUOTES.sdg13, QUOTES.sternin];
}

export const PROOF_LABEL: Record<string, string> = {
  organiser_email: 'Email or screenshot from the organiser',
  organiser_document: 'Participation document from the organiser',
  attendance_photo: 'Attendance photo',
  sample: 'Sample proof (demo mode)',
};

const sha256 = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
/** Tonnes as a number only: the label ("t CO2 (grid) + t CO2e (fuels)") carries the unit. */
const t2 = (n: number) => dec(Math.round(n * 100) / 100);

/** The unit's own latest figures: Rs at stake a month and t CO2 in the latest month. */
async function unitFigures(site: Site) {
  const org = await prisma.organisation.findFirst({ where: { id: site.orgId } });
  if (!org) throw new AppError(404, 'NOT_FOUND', 'Organisation not found');
  const carbon = await computeCarbon(site);
  const latest = await resolveMonth(site.orgId, site.id);
  const insights = await computeInsights(site, latest, null, { card: false });
  return { org, carbon, latest, atStakeInr: Math.round(insights.atStake.inrPerMonth) };
}

async function seal(
  site: Site,
  type: 'request_pack' | 'participation_certificate',
  results: { reportId: string; version: number; issuedAt: string },
  html: string,
  footer: string,
  extra: { factorIds: string[]; formulaVersion: string; actionCode: string; landscape?: boolean },
) {
  const pdf = await pdfRenderer.render(html, {
    footerTemplate: footerHtml(footer, results.reportId, verifyUrlFor(results.reportId)),
    landscape: extra.landscape,
  });
  const hash = sha256(pdf);
  const fileKey = `reports/${site.orgId}/${results.reportId}.pdf`;
  await storage.put(fileKey, pdf, 'application/pdf');
  const snapshotId = randomUUID();
  const issuedAt = new Date(results.issuedAt);
  const factors = await prisma.factor.findMany({
    where: { id: { in: [...new Set(extra.factorIds)] } },
    select: { id: true },
  });
  await prisma.$transaction([
    prisma.reportSnapshot.create({
      data: {
        id: snapshotId,
        orgId: site.orgId,
        siteId: site.id,
        type,
        language: 'en',
        actionCode: extra.actionCode,
        inputsJson: { mitraCode: extra.actionCode },
        resultsJson: results as object,
        factorIds: factors.map((f) => f.id),
        formulaVersion: extra.formulaVersion,
        createdAt: issuedAt,
      },
    }),
    prisma.report.create({
      data: {
        id: results.reportId,
        orgId: site.orgId,
        snapshotId,
        type,
        language: 'en',
        fileKey,
        sha256: hash,
        version: results.version,
        createdAt: issuedAt,
      },
    }),
  ]);
  return { reportId: results.reportId, version: results.version, sha256: hash, fileKey };
}

const nextVersion = (site: Site, type: string, code: string) =>
  prisma.report
    .count({ where: { orgId: site.orgId, snapshot: { siteId: site.id, type, actionCode: code } } })
    .then((n) => n + 1);

// ------------------------------------------------------------------ request pack

export interface RequestPackResults {
  reportId: string;
  version: number;
  issuedAt: string;
  isSample: boolean;
  verifyUrl: string;
  title: string;
  programme: string;
  business: { name: string; siteAddress: string };
  latestMonth: string;
  latestT: number;
  label: string;
  atStakeInr: number;
  months: Array<{ month: string; scope1T: number; scope2T: number; totalT: number }>;
  topActions: Array<{
    title: string;
    inrPerYearLow: number | null;
    inrPerYearHigh: number | null;
    tPerYearLow: number | null;
    tPerYearHigh: number | null;
  }>;
  schemes: Array<{ name: string; statusText: string }>;
  methodLines: string[];
  closing: string;
}

const requestPackTemplate = readFileSync(
  new URL('./templates/request-pack.html', import.meta.url),
  'utf8',
);

export async function renderRequestPackHtml(r: RequestPackResults): Promise<string> {
  const qrDataUrl = await QRCode.toDataURL(r.verifyUrl, { margin: 1, width: 300 });
  const range = (lo: number | null, hi: number | null, f: (n: number) => string) =>
    lo == null || hi == null ? '-' : `${f(lo)} - ${f(hi)}`;
  return fill('request-pack', requestPackTemplate, {
    title: r.title,
    reportId: r.reportId,
    version: String(r.version),
    issuedDate: dateText(r.issuedAt),
    sampleBadge: r.isSample ? '<p><span class="badge">Sample data (synthetic)</span></p>' : '',
    businessName: r.business.name,
    siteAddress: r.business.siteAddress,
    latestMonth: monthName(r.latestMonth),
    atStake: inr(r.atStakeInr),
    latestTotal: `${t2(r.latestT)} ${r.label}`,
    ask: REQUEST_PACK_ASK,
    monthsTable: table(
      ['Month', 'Scope 1 (t CO2e)', 'Scope 2 (t CO2)', 'Total (t)'],
      r.months.map((m) => [monthName(m.month), dec(m.scope1T), dec(m.scope2T), dec(m.totalT)]),
      [1, 2, 3],
    ),
    periodTotal: `${t2(r.months.reduce((t, m) => t + m.totalT, 0))} ${r.label}`,
    actionsTable: table(
      ['Action', 'Rs a year (low - high)', 't CO2 a year (low - high)'],
      r.topActions.map((a) => [
        a.title,
        range(a.inrPerYearLow, a.inrPerYearHigh, inr),
        range(a.tPerYearLow, a.tPerYearHigh, (n) => dec(Math.round(n * 10) / 10)),
      ]),
      [1, 2],
    ),
    schemesList: r.schemes.length
      ? `<ul>${r.schemes.map((s) => `<li><b>${esc(s.name)}</b>: ${esc(s.statusText)}</li>`).join('')}</ul>`
      : '<p>None matched yet.</p>',
    methodLines: r.methodLines.map(esc).join('<br />'),
    qrDataUrl,
    verifyUrl: r.verifyUrl,
    closing: r.closing,
  });
}

export async function createRequestPack(site: Site, item: MitraItem) {
  const { org, carbon, latest, atStakeInr } = await unitFigures(site);
  const [{ actions }, schemes] = await Promise.all([
    listActions(site, latest, null),
    computeSchemes(site),
  ]);
  const reportId = randomUUID();
  const results: RequestPackResults = {
    reportId,
    version: await nextVersion(site, 'request_pack', item.code),
    issuedAt: new Date().toISOString(),
    isSample: DEMO_ORG_IDS.includes(site.orgId),
    verifyUrl: verifyUrlFor(reportId),
    title: REQUEST_PACK_TITLE,
    programme: REQUEST_PACK_PROGRAMME,
    business: { name: org.name, siteAddress: site.address ?? 'not given' },
    latestMonth: carbon.latestMonth.month,
    latestT: carbon.latestMonth.totalT,
    label: carbon.label,
    atStakeInr,
    months: carbon.months.map((m) => ({
      month: m.month,
      scope1T: m.scope1T,
      scope2T: m.scope2T,
      totalT: m.totalT,
    })),
    topActions: actions.slice(0, 3).map((a) => ({
      title: MEASURE_TITLE[a.code] ?? a.title,
      inrPerYearLow: a.inrPerMonthLow == null ? null : a.inrPerMonthLow * 12,
      inrPerYearHigh: a.inrPerMonthHigh == null ? null : a.inrPerMonthHigh * 12,
      tPerYearLow: a.co2?.tPerYearLow ?? null,
      tPerYearHigh: a.co2?.tPerYearHigh ?? null,
    })),
    schemes: schemes.matches
      .filter((m) => m.status !== 'not_eligible')
      .slice(0, 3)
      .map((m) => ({ name: m.name, statusText: m.statusText })),
    methodLines: carbon.method.lines,
    closing: REQUEST_PACK_CLOSING,
  };
  const html = await renderRequestPackHtml(results);
  return seal(site, 'request_pack', results, html, REQUEST_PACK_CLOSING, {
    factorIds: carbon.factorIds,
    formulaVersion: carbon.formulaVersion,
    actionCode: item.code,
  });
}

/** What the web needs for the "Email it to RICH" mailto (from the stored pack snapshot). */
export async function requestPackInfo(site: Site, step: MitraStep | null | undefined) {
  if (!step?.packReportId) return null;
  const report = await prisma.report.findFirst({
    where: { id: step.packReportId, orgId: site.orgId },
    include: { snapshot: true },
  });
  if (!report) return null;
  const r = report.snapshot.resultsJson as unknown as RequestPackResults;
  return {
    reportId: report.id,
    verifyUrl: r.verifyUrl,
    businessName: r.business.name,
    latestMonth: r.latestMonth,
    latestT: r.latestT,
    label: r.label,
    atStakeInr: r.atStakeInr,
    topActionTitle: r.topActions[0]?.title ?? null,
    email: REQUEST_PACK_EMAIL,
    subject: MAIL_SUBJECT(r.business.name),
    body: mailBody(r),
  };
}

// ------------------------------------------------- Certificate of Participation

export interface CertificateResults {
  reportId: string;
  version: number;
  issuedAt: string;
  isSample: boolean;
  verifyUrl: string;
  title: typeof CERT_TITLE;
  business: { name: string };
  step: { code: string; title: string; runBy: string };
  eventDate: string;
  businessGain: string;
  figures: { atStakeInr: number; month: string; totalT: number; label: string };
  sdgLine: string;
  quotes: Array<{ text: string; source: string; url: string }>;
  evidence: string;
  footer: string;
}

const certTemplate = readFileSync(
  new URL('./templates/participation-certificate.html', import.meta.url),
  'utf8',
);

export const unitFiguresLine = (f: CertificateResults['figures']) =>
  `Your unit's own figures: ${inr(f.atStakeInr)} a month at stake on the power bill, and ${t2(f.totalT)} ${f.label} in ${monthName(f.month)}.`;

export async function renderCertificateHtml(r: CertificateResults): Promise<string> {
  const qrDataUrl = await QRCode.toDataURL(r.verifyUrl, { margin: 1, width: 300 });
  return fill('participation-certificate', certTemplate, {
    reportId: r.reportId,
    watermark: r.isSample ? '<div class="watermark">SAMPLE</div>' : '',
    businessName: r.business.name,
    stepTitle: r.step.title,
    runBy: r.step.runBy,
    eventDate: dateText(`${r.eventDate}T12:00:00Z`),
    businessGain: r.businessGain,
    unitFigures: unitFiguresLine(r.figures),
    sdgLine: r.sdgLine,
    quotes: r.quotes
      .map(
        (q) =>
          `<blockquote>“${esc(q.text)}”<span class="src">${esc(q.source)} · ${esc(q.url)}</span></blockquote>`,
      )
      .join(''),
    evidence: r.evidence,
    footer: r.footer,
    qrDataUrl,
  });
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Only for a confirmed step (the owner uploaded proof). Everything else is 403. */
export async function createCertificate(site: Site, item: MitraItem, step: MitraStep) {
  if (step.status !== 'confirmed' || !step.proofType) {
    throw new AppError(
      403,
      'NOT_CONFIRMED',
      'A Certificate of Participation needs a confirmed step: upload proof first',
    );
  }
  const { org, carbon, atStakeInr } = await unitFigures(site);
  const reportId = randomUUID();
  const now = new Date();
  const confirmedOn = isoDay(step.updatedAt);
  const results: CertificateResults = {
    reportId,
    version: await nextVersion(site, 'participation_certificate', item.code),
    issuedAt: now.toISOString(),
    isSample: DEMO_ORG_IDS.includes(site.orgId),
    verifyUrl: verifyUrlFor(reportId),
    title: CERT_TITLE,
    business: { name: org.name },
    step: { code: item.code, title: item.title, runBy: item.runBy },
    eventDate: step.eventDate ? isoDay(step.eventDate) : confirmedOn,
    businessGain: item.businessGain,
    figures: {
      atStakeInr,
      month: carbon.latestMonth.month,
      totalT: carbon.latestMonth.totalT,
      label: carbon.label,
    },
    sdgLine: item.carbonLine ?? `${QUOTES.sdg13.source}: ${QUOTES.sdg13.text}`,
    quotes: quotesFor(item.code).map((q) => ({ ...q })),
    evidence: `Confirmed by: ${PROOF_LABEL[step.proofType] ?? step.proofType} uploaded by the owner on ${dateText(`${confirmedOn}T12:00:00Z`)}`,
    footer: certFooter(item.runBy, item.code),
  };
  const html = await renderCertificateHtml(results);
  return seal(site, 'participation_certificate', results, html, CERT_TITLE, {
    factorIds: carbon.factorIds,
    formulaVersion: carbon.formulaVersion,
    actionCode: item.code,
    landscape: true,
  });
}
