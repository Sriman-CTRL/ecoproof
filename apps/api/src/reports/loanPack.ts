import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  cashTest,
  dataQualityScore,
  emi,
  fitBaseline,
  FORMULA_VERSION,
  simplePaybackYears,
  type QualityTag,
} from '@ecoproof/calc';
import type { Report, ReportSnapshot, Site } from '@prisma/client';
import QRCode from 'qrcode';
import { z } from 'zod';
import { storage } from '../adapters/storage.js';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { DEMO_ORG_IDS } from '../demo/ids.js';
import { AppError } from '../errors.js';
import type { CertificateResults, RequestPackResults } from './mitraDocs.js';
import type { CarbonStatementResults } from './carbonStatement.js';
import type { CbamResults } from './cbamSheet.js';
import { dateText, dec, fill, footerHtml, inr, int, monthName, table, esc } from './html.js';
import { pdfRenderer } from './pdfRenderer.js';
import { listActions, type ActionItem } from '../services/actions.js';
import { computeSchemes } from '../services/schemes.js';
import { ACTION_CODE, BASELINE_RULES, type FindingCode } from '../services/insights.js';

export const LoanPackBody = z.object({
  actionCode: z.string().min(1),
  quote: z
    .object({
      vendorName: z.string().trim().min(1).max(200),
      amountInr: z.number().positive(),
    })
    .optional(),
  loan: z.object({
    amountInr: z.number().positive(),
    ratePct: z.number().min(0).max(100),
    tenureMonths: z.number().int().positive().max(600),
  }),
  language: z.literal('en').default('en'),
});
export type LoanPackBody = z.infer<typeof LoanPackBody>;

/** Fixed phrases (Doc 05 "Wording and labelling rules"). */
export const LENDER_LINE = "Summary for the lender's own assessment. Not an approval or sanction.";
export const RUPEES_NOT_UNITS = 'saves rupees, not units of energy';
const NOT_GIVEN = 'not given';
export const ZED_LINE =
  'ZED Bronze certification is free for this unit with the joining reward; several banks offer rate concessions for ZED units.';
/** Sourced cost range with its price year, e.g. "Rs 20,000 to Rs 1,20,000 (2011 / 2020 prices; get a current quote)". */
function libraryCostText(a: ActionItem): string {
  if (a.costLow == null || a.costHigh == null) return COST_PENDING;
  const range =
    a.costLow === a.costHigh ? inr(a.costLow) : `${inr(a.costLow)} to ${inr(a.costHigh)}`;
  return `${range} (${a.costYear ?? 'undated'} prices; get a current quote)`;
}

const COST_PENDING = 'cost pending: get a quote';

const FINDING_TITLE: Record<FindingCode, string> = {
  power_factor: 'Low power factor (billed in kVAh)',
  peak_use: 'High share of units in peak hours',
  contracted_demand: 'Contracted demand above real maximum demand',
  minimum_charges: 'Use below minimum billed units',
  lt_surcharges: 'Power factor or capacitor surcharge',
};

/** Same English names the app shows (apps/web/src/locales/en.json actions.name). */
export const MEASURE_TITLE: Record<string, string> = {
  fix_power_factor: 'Fix power factor (APFC panel)',
  shift_peak_use_to_solar_hours: 'Shift work out of peak hours',
  reduce_contracted_demand: 'Reduce contracted demand',
  avoid_minimum_charges: 'Avoid minimum charges',
};

export interface LoanPackResults {
  reportId: string;
  version: number;
  issuedAt: string;
  isSample: boolean;
  verifyUrl: string;
  business: {
    name: string;
    udyamNo: string;
    gstin: string;
    city: string;
    yearsInOperation: string;
    /** Owner-entered profile (FIN-1); absent on packs made before S8b. */
    udyamCategory?: string;
    gstRegistered?: string;
    siteAddress: string;
  };
  /** One line on the ZED path when the scheme matcher says ZED is likely; else null. */
  zedLine?: string | null;
  /** Date the scheme rules used for the ZED line were last checked (Doc 05). */
  schemesLastChecked?: string | null;
  months: Array<{
    month: string;
    kwh: number | null;
    kvah: number | null;
    pf: number | null;
    mdKva: number | null;
    inr: number | null;
    documentId: string | null;
    energyMonthId: string;
  }>;
  baseline: {
    method: string;
    months: number;
    cvRmsePct: number | null;
    nmbePct: number | null;
    pass: boolean;
    limits: typeof BASELINE_RULES;
  } | null;
  billMonth: string;
  findings: Array<{
    code: FindingCode;
    title: string;
    inrPerMonth: number | null;
    status: 'pending' | 'fixed';
    rule: string;
  }>;
  measure: {
    code: string;
    title: string;
    isZeroCost: boolean;
    savingLow: number;
    savingHigh: number;
    source: string;
    quote: { vendorName: string; amountInr: number } | null;
    costText: string;
    paybackYears: number | null;
  };
  loan: {
    amountInr: number;
    ratePct: number;
    tenureMonths: number;
    emi: number;
    netMonthly: number;
    cashPositiveFromMonth1: boolean;
  };
  carbon: {
    co2TonnesPerYearAvoided: number | null;
    note: string | null;
    intensityBefore: number | null;
    /** D6b: t CO2 a year cut by the measure (same kWh range as the rupees) and its factor. */
    co2Range?: {
      low: number;
      high: number;
      factor: {
        id: string;
        value: number;
        unit: string;
        version: string | null;
        source: string;
        page: string | null;
      };
    } | null;
    /** D6b: the unit's footprint over the snapshot's bill months. */
    footprint?: { months: number; scope2T: number; scope1T: number; totalT: number } | null;
  };
  dataQuality: {
    measuredSharePct: number;
    belowThreshold: boolean;
    byTag: Record<string, { tonnes: number; sharePct: number }>;
  } | null;
  factors: Array<{
    id: string;
    sourceType: string;
    value: number;
    unit: string;
    version: string | null;
    status: string;
  }>;
  tariffRules: string[];
  formulaVersion: string;
}

const num = (d: { toString(): string } | null | undefined) => (d == null ? null : Number(d));
const iso = (d: Date) => d.toISOString().slice(0, 10);

export const verifyUrlFor = (reportId: string) =>
  `${config.PUBLIC_WEB_URL.replace(/\/$/, '')}/verify/${reportId}`;

/** Doc 05 step 2: freeze inputs, results, factor versions and data quality into one snapshot. */
export async function buildSnapshot(
  site: Site,
  body: LoanPackBody,
  ids: { reportId: string; version: number; issuedAt: Date },
  /** Seed use only: build the pack from bills up to this month (default: all bills). */
  asOfMonth?: Date,
) {
  const orgId = site.orgId;
  const org = await prisma.organisation.findFirst({ where: { id: orgId } });
  if (!org) throw new AppError(404, 'NOT_FOUND', 'Organisation not found');

  const months = await prisma.energyMonth.findMany({
    where: {
      orgId,
      siteId: site.id,
      ...(asOfMonth ? { periodStart: { lte: asOfMonth } } : {}),
    },
    orderBy: { periodStart: 'desc' },
    take: 12,
  });
  if (!months.length) throw new AppError(404, 'NO_BILLS', 'No confirmed bills yet');
  const latest = months[0]!.periodStart;
  months.reverse();
  const starts = months.map((m) => m.periodStart);

  const { insights, actions } = await listActions(site, latest, null);
  const action = actions.find((a) => a.code === body.actionCode);
  if (!action) throw new AppError(404, 'NOT_FOUND', 'Action not in this site plan');
  if (!['planned', 'in_progress', 'done'].includes(action.status)) {
    throw new AppError(409, 'NOT_PLANNED', 'Plan the action before making a loan-ready summary');
  }
  if (action.inrPerMonthLow == null || action.inrPerMonthHigh == null) {
    throw new AppError(422, 'NO_SAVING', 'This action has no rupee saving yet');
  }

  const [extractions, results, production, fuels, siteActions] = await Promise.all([
    prisma.extraction.findMany({
      where: { orgId, model: 'owner_confirmed', document: { siteId: site.id } },
      select: { documentId: true, fieldsJson: true },
    }),
    prisma.result.findMany({ where: { orgId, siteId: site.id, month: { in: starts } } }),
    prisma.productionMonth.findMany({ where: { orgId, siteId: site.id, month: { in: starts } } }),
    prisma.fuelEntry.findMany({
      where: { orgId, siteId: site.id, date: { gte: starts[0], lte: months.at(-1)!.periodEnd } },
    }),
    prisma.siteAction.findMany({
      where: { orgId, siteId: site.id },
      include: { action: { select: { code: true } } },
    }),
  ]);
  const docByPeriod = new Map(
    extractions.map((e) => [(e.fieldsJson as { periodStart?: string }).periodStart, e.documentId]),
  );
  const prodBy = new Map(production.map((p) => [p.month.getTime(), Number(p.quantity)]));

  // Baseline fit over the same 12 months (Doc 03, ASHRAE Guideline 14 limits).
  const fitMonths = months.flatMap((m) => {
    const p = prodBy.get(m.periodStart.getTime());
    return p && p > 0 && m.kwh != null ? [{ productionTonnes: p, kwh: Number(m.kwh) }] : [];
  });
  let baseline: LoanPackResults['baseline'] = null;
  if (fitMonths.length >= 2) {
    try {
      const fit = fitBaseline({ months: fitMonths, rules: BASELINE_RULES });
      baseline = {
        method: fit.method,
        months: fit.n,
        cvRmsePct: fit.cvRmsePct,
        nmbePct: fit.nmbePct,
        pass: fit.method === 'regression',
        limits: BASELINE_RULES,
      };
    } catch {
      baseline = null; // identical production every month: no fit
    }
  }

  const done = new Set(siteActions.filter((s) => s.status === 'done').map((s) => s.action.code));
  const findings = insights.findings.map((f) => ({
    code: f.code,
    title: FINDING_TITLE[f.code],
    inrPerMonth: f.inrPerMonth,
    status: done.has(ACTION_CODE[f.code]) ? ('fixed' as const) : ('pending' as const),
    rule: `${f.rule.line}, valid from ${f.rule.validFrom ?? 'not stated'}`,
  }));

  const savingLow = action.inrPerMonthLow;
  const savingHigh = action.inrPerMonthHigh;
  const quote = body.quote ?? null;
  // Owner's quote first; else the sourced library cost range (its price year is printed).
  const paybackYears = quote
    ? simplePaybackYears({
        capexInr: quote.amountInr,
        annualSavingInrMid: ((savingLow + savingHigh) / 2) * 12,
      })
    : action.paybackYears;
  const e = emi({
    principal: body.loan.amountInr,
    annualRatePct: body.loan.ratePct,
    months: body.loan.tenureMonths,
  });
  const cash = cashTest({ emi: e, monthlySavingLow: savingLow });

  // Carbon: bill-derived fixes (kVAh, demand, billing) save rupees, not kWh.
  const savesUnits = action.finding == null && action.enduse === 'electricity';
  const totalCo2 = results.reduce((t, r) => t + Number(r.scope1 ?? 0) + Number(r.scope2 ?? 0), 0);
  const scope2Sum = results.reduce((t, r) => t + Number(r.scope2 ?? 0), 0);
  const scope1Sum = results.reduce((t, r) => t + Number(r.scope1 ?? 0), 0);
  const co2Factor =
    savesUnits && action.co2
      ? await prisma.factor.findUnique({ where: { id: action.co2.factorId } })
      : null;
  const totalTonnes = results.reduce((t, r) => t + (prodBy.get(r.month.getTime()) ?? 0), 0);

  // Data quality: share of emissions resting on measured inputs (Doc 03).
  const tagByMonth = new Map(months.map((m) => [m.periodStart.getTime(), m.qualityTag]));
  const items: Array<{ tonnes: number; tag: QualityTag }> = [];
  for (const r of results) {
    const s2 = Number(r.scope2 ?? 0);
    if (s2 > 0) items.push({ tonnes: s2, tag: tagByMonth.get(r.month.getTime()) ?? 'default' });
    const s1 = Number(r.scope1 ?? 0);
    if (s1 > 0) {
      const em = months.find((m) => m.periodStart.getTime() === r.month.getTime());
      const inMonth = fuels.filter((f) => em && f.date >= em.periodStart && f.date <= em.periodEnd);
      const qty = inMonth.reduce((t, f) => t + Number(f.quantity), 0);
      if (qty > 0) {
        for (const f of inMonth) {
          items.push({ tonnes: (s1 * Number(f.quantity)) / qty, tag: f.qualityTag });
        }
      } else {
        items.push({ tonnes: s1, tag: 'default' });
      }
    }
  }
  const dq = items.length ? dataQualityScore(items) : null;

  const factorIds = [...new Set(results.flatMap((r) => r.factorIds))];
  const factors = await prisma.factor.findMany({ where: { id: { in: factorIds } } });

  const schemes = await computeSchemes(site, ids.issuedAt);
  const resultsJson: LoanPackResults = {
    reportId: ids.reportId,
    version: ids.version,
    issuedAt: ids.issuedAt.toISOString(),
    isSample: DEMO_ORG_IDS.includes(orgId),
    verifyUrl: verifyUrlFor(ids.reportId),
    business: {
      name: org.name,
      udyamNo: org.udyamNo ?? NOT_GIVEN,
      gstin: org.gstin ?? NOT_GIVEN,
      city: NOT_GIVEN, // no city field stored (OPEN_ITEMS)
      yearsInOperation: org.yearsInOperation == null ? NOT_GIVEN : String(org.yearsInOperation),
      udyamCategory: org.udyamCategory ?? NOT_GIVEN,
      gstRegistered: org.gstRegistered == null ? NOT_GIVEN : org.gstRegistered ? 'yes' : 'no',
      siteAddress: site.address ?? NOT_GIVEN,
    },
    zedLine: schemes.zed?.status === 'likely' ? ZED_LINE : null,
    schemesLastChecked: schemes.zed?.lastChecked ?? null,
    months: months.map((m) => {
      const energy = num(m.energyCharges);
      const demand = num(m.demandCharges);
      return {
        month: iso(m.periodStart),
        kwh: num(m.kwh),
        kvah: num(m.kvah),
        pf: num(m.pf),
        mdKva: num(m.mdKva),
        inr: energy == null && demand == null ? null : (energy ?? 0) + (demand ?? 0),
        documentId: docByPeriod.get(iso(m.periodStart)) ?? null,
        energyMonthId: m.id,
      };
    }),
    baseline,
    billMonth: insights.month,
    findings,
    measure: {
      code: action.code,
      title: MEASURE_TITLE[action.code] ?? action.title,
      isZeroCost: action.isZeroCost,
      savingLow,
      savingHigh,
      source: action.source,
      quote,
      costText: quote
        ? inr(quote.amountInr)
        : action.isZeroCost
          ? 'No capital cost'
          : libraryCostText(action),
      paybackYears,
    },
    loan: {
      ...body.loan,
      emi: e,
      netMonthly: cash.netMonthly,
      cashPositiveFromMonth1: cash.cashPositiveFromMonth1,
    },
    carbon: {
      co2TonnesPerYearAvoided: savesUnits ? action.co2TonnesPerYear : null,
      note: savesUnits ? null : RUPEES_NOT_UNITS,
      intensityBefore: totalTonnes > 0 ? totalCo2 / totalTonnes : null,
      co2Range:
        action.co2 && co2Factor
          ? {
              low: action.co2.tPerYearLow,
              high: action.co2.tPerYearHigh,
              factor: {
                id: co2Factor.id,
                value: Number(co2Factor.value),
                unit: co2Factor.unit,
                version: co2Factor.version,
                source: co2Factor.source,
                page: co2Factor.page,
              },
            }
          : null,
      footprint: results.length
        ? { months: results.length, scope2T: scope2Sum, scope1T: scope1Sum, totalT: totalCo2 }
        : null,
    },
    dataQuality: dq,
    factors: factors.map((f) => ({
      id: f.id,
      sourceType: f.sourceType,
      value: Number(f.value),
      unit: f.unit,
      version: f.version,
      status: f.status,
    })),
    tariffRules: [...new Set(insights.findings.concat(insights.passed).map((f) => f.rule.line))],
    formulaVersion: FORMULA_VERSION,
  };

  return {
    inputsJson: {
      request: body,
      energyMonthIds: months.map((m) => m.id),
      resultIds: results.map((r) => r.id),
      documentIds: [
        ...new Set(resultsJson.months.flatMap((m) => (m.documentId ? [m.documentId] : []))),
      ],
    },
    resultsJson,
    factorIds,
    formulaVersion: FORMULA_VERSION,
    dataQualityScore: dq ? Math.round(dq.measuredSharePct * 100) / 100 : null,
  };
}

const sha256 = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');

/**
 * Doc 05 steps 2-4: snapshot, render, seal, store. Regenerating for the same action makes
 * version n+1; old versions stay valid. `reportId` and `asOfMonth` are for the demo seed only
 * (a fixed id so the landing QR keeps working after a reset).
 */
export async function createLoanPack(
  site: Site,
  body: LoanPackBody,
  seed: { reportId?: string; asOfMonth?: Date } = {},
) {
  const orgId = site.orgId;
  const previous = await prisma.report.count({
    where: { orgId, snapshot: { siteId: site.id, type: 'loan_pack', actionCode: body.actionCode } },
  });
  const ids = {
    reportId: seed.reportId ?? randomUUID(),
    version: previous + 1,
    issuedAt: new Date(),
  };
  const snapshotId = randomUUID();

  const snap = await buildSnapshot(site, body, ids, seed.asOfMonth);
  const html = await renderHtml(snap.resultsJson, snapshotId);
  const pdf = await pdfRenderer.render(html, {
    footerTemplate: footerTemplate(ids.reportId, verifyUrlFor(ids.reportId)),
  });
  const seal = sha256(pdf);
  const fileKey = `reports/${orgId}/${ids.reportId}.pdf`;
  await storage.put(fileKey, pdf, 'application/pdf');

  await prisma.$transaction([
    prisma.reportSnapshot.create({
      data: {
        id: snapshotId,
        orgId,
        siteId: site.id,
        type: 'loan_pack',
        language: body.language,
        actionCode: body.actionCode,
        inputsJson: snap.inputsJson,
        resultsJson: snap.resultsJson as object,
        factorIds: snap.factorIds,
        formulaVersion: snap.formulaVersion,
        dataQualityScore: snap.dataQualityScore,
        createdAt: ids.issuedAt,
      },
    }),
    prisma.report.create({
      data: {
        id: ids.reportId,
        orgId,
        snapshotId,
        type: 'loan_pack',
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

// ---------------------------------------------------------------- rendering

const template = readFileSync(new URL('./templates/loan-pack.html', import.meta.url), 'utf8');

/**
 * D6b "Carbon impact" block on the measure page: the t CO2 a year range the measure cuts, with its
 * factor and source, and the unit's footprint over the snapshot months. Older snapshots (no
 * co2Range / footprint) render without it: past results stay as published.
 */
const factor3 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 });

function carbonBlock(r: LoanPackResults): string {
  const c = r.carbon;
  const rows: string[] = [];
  if (c.co2Range) {
    const f = c.co2Range.factor;
    rows.push(
      `<dt>CO2 cut per year</dt><dd>${esc(`${dec(c.co2Range.low)} to ${dec(c.co2Range.high)} t CO2 a year (kWh saved x ${factor3.format(f.value)} ${f.unit})`)}</dd>`,
      `<dt>Factor</dt><dd>${esc(`${f.version ?? ''} ${f.source}${f.page ? `, ${f.page}` : ''}`.trim())}</dd>`,
    );
  } else if (c.note) {
    rows.push(`<dt>CO2 cut per year</dt><dd>${esc(`none claimed: this measure ${c.note}`)}</dd>`);
  }
  if (c.footprint) {
    const p = c.footprint;
    rows.push(
      `<dt>Unit footprint (${p.months} months)</dt><dd>${esc(`${dec(p.scope2T)} t CO2 (grid) + ${dec(p.scope1T)} t CO2e (fuels) = ${dec(p.totalT)} t`)}</dd>`,
    );
  }
  if (!rows.length) return '';
  return `<h3 style="margin-top: 6mm">Carbon impact</h3><dl class="kv">${rows.join('')}</dl>`;
}

export async function renderHtml(r: LoanPackResults, snapshotId: string): Promise<string> {
  const qrDataUrl = await QRCode.toDataURL(r.verifyUrl, { margin: 1, width: 300 });
  const m = r.measure;
  const range =
    m.savingLow === m.savingHigh
      ? `${inr(m.savingLow)} per month`
      : `${inr(m.savingLow)} to ${inr(m.savingHigh)} per month`;
  const b = r.baseline;
  const baselineBlock = b
    ? table(
        ['Method', 'Months', 'CV(RMSE)', 'NMBE', 'Result'],
        [
          [
            b.method,
            String(b.months),
            b.cvRmsePct == null ? '-' : `${dec(b.cvRmsePct)}% (limit ${b.limits.maxCvRmsePct}%)`,
            b.nmbePct == null ? '-' : `${dec(b.nmbePct)}% (limit ±${b.limits.maxAbsNmbePct}%)`,
            b.pass ? 'Pass: fit accepted' : 'Fail: indicative only',
          ],
        ],
      ) +
      '<p class="muted" style="margin-top:2mm">Model: monthly kWh = a + b x tonnes of output, fitted on the months above (ASHRAE Guideline 14 limits).</p>'
    : '<p>Not enough months with production to fit a baseline.</p>';

  const dq = r.dataQuality;
  const vars: Record<string, string> = {
    reportId: r.reportId,
    version: String(r.version),
    snapshotId,
    issuedDate: dateText(r.issuedAt),
    sampleBadge: r.isSample ? '<p><span class="badge">Sample data (synthetic)</span></p>' : '',
    businessName: r.business.name,
    udyamNo: r.business.udyamNo,
    gstin: r.business.gstin,
    yearsInOperation: r.business.yearsInOperation,
    udyamCategory: r.business.udyamCategory ?? NOT_GIVEN,
    gstRegistered: r.business.gstRegistered ?? NOT_GIVEN,
    zedLine: r.zedLine ? `<p class="muted" style="margin-top:2mm">${esc(r.zedLine)}</p>` : '',
    schemesChecked: r.schemesLastChecked
      ? ` Scheme rules last checked ${dateText(`${r.schemesLastChecked}T00:00:00Z`)}.`
      : '',
    siteAddress: r.business.siteAddress,
    city: r.business.city,
    qrDataUrl,
    verifyUrl: r.verifyUrl,
    measureTitle: m.title,
    costText: m.costText,
    savingRange: range,
    emiText: `${inr(r.loan.emi)} per month`,
    loanTerms: `${inr(r.loan.amountInr)} at ${dec(r.loan.ratePct)}% for ${r.loan.tenureMonths} months`,
    netMonthlyText: `${r.loan.netMonthly >= 0 ? '+' : '-'}${inr(Math.abs(r.loan.netMonthly))} per month`,
    cashTestLine: r.loan.cashPositiveFromMonth1
      ? 'The low-end saving is above the EMI from month 1.'
      : 'The low-end saving does not cover the EMI.',
    measureSource: m.source,
    monthCount: String(r.months.length),
    monthsTable: table(
      ['Month', 'Rupees', 'kWh', 'kVAh', 'PF', 'MD (kVA)', 'Bill document'],
      r.months.map((x) => [
        monthName(x.month),
        x.inr == null ? '-' : inr(x.inr),
        int(x.kwh),
        int(x.kvah),
        x.pf == null ? '-' : x.pf.toFixed(2),
        int(x.mdKva),
        x.documentId ? x.documentId.slice(0, 8) : 'sample record (no file)',
      ]),
      [1, 2, 3, 4, 5],
    ),
    baselineBlock,
    billMonth: monthName(r.billMonth),
    findingsTable: r.findings.length
      ? table(
          ['Finding', 'Rupees per month', 'Status', 'Tariff rule'],
          r.findings.map((f) => [
            f.title,
            f.inrPerMonth == null ? 'not valued yet (needs units to move)' : inr(f.inrPerMonth),
            f.status,
            f.rule,
          ]),
          [1],
        )
      : '<p>No findings on the latest bill.</p>',
    quoteText: m.quote ? `${m.quote.vendorName}: ${inr(m.quote.amountInr)}` : COST_PENDING,
    paybackText:
      m.paybackYears == null
        ? m.quote
          ? 'not available'
          : `not available (${COST_PENDING})`
        : `${dec(m.paybackYears)} years (${dec(m.paybackYears * 12)} months)`,
    co2Avoided: r.carbon.co2Range
      ? `${dec(r.carbon.co2Range.low)} to ${dec(r.carbon.co2Range.high)} t CO2 per year`
      : r.carbon.co2TonnesPerYearAvoided != null
        ? `${dec(r.carbon.co2TonnesPerYearAvoided)} t CO2 per year`
        : (r.carbon.note ?? 'not estimated'),
    carbonBlock: carbonBlock(r),
    intensityBefore:
      r.carbon.intensityBefore == null
        ? '-'
        : `${dec(r.carbon.intensityBefore)} t CO2 per tonne of output (grid electricity and diesel)`,
    intensityAfter: r.carbon.note ? `unchanged: this measure ${r.carbon.note}` : 'not estimated',
    measuredSharePct: dq ? `${dec(dq.measuredSharePct)}%` : '-',
    qualityWarning:
      dq && dq.belowThreshold
        ? '<p class="warn">Less than 70% of emissions rest on measured inputs.</p>'
        : '',
    qualityTable: dq
      ? table(
          ['Input type', 'Emissions (t)', 'Share'],
          Object.entries(dq.byTag)
            .filter(([, v]) => v.tonnes > 0)
            .map(([k, v]) => [k.replace('_', ' '), dec(v.tonnes), `${dec(v.sharePct)}%`]),
          [1, 2],
        )
      : '',
    factorsTable: table(
      ['Factor', 'Value', 'Version', 'Status', 'ID'],
      r.factors.map((f) => [
        f.sourceType,
        `${dec(f.value)} ${f.unit}`,
        f.version ?? '-',
        f.status,
        f.id.slice(0, 8),
      ]),
      [1],
    ),
    formulaVersion: r.formulaVersion,
    tariffRules: r.tariffRules.join('; ') || 'none',
  };
  return fill('loan-pack', template, vars);
}

export function footerTemplate(reportId: string, verifyUrl: string): string {
  return footerHtml(LENDER_LINE, reportId, verifyUrl);
}

/** The only fields the public verify page and share links may show (Doc 05). */
export function verifyView(report: Report & { snapshot: ReportSnapshot }) {
  const base = {
    reportId: report.id,
    type: report.type,
    issuedAt: report.createdAt.toISOString(),
    version: report.version,
    sha256: report.sha256,
  };
  if (report.type === 'cbam_sheet') {
    const c = report.snapshot.resultsJson as unknown as CbamResults;
    return {
      ...base,
      businessName: c.installation.operatorName,
      headline: {
        kind: 'cbam_sheet' as const,
        label: c.label,
        period: c.period,
        products: c.products.map((p) => ({
          cnCode: p.cnCode,
          description: p.ownerDescription,
          tonnes: p.tonnes,
          inScopeNow: p.inScopeNow,
          seeDirect: Math.round(p.seeDirect * 1000) / 1000,
        })),
      },
    };
  }
  if (report.type === 'carbon_statement') {
    const c = (report.snapshot.resultsJson as unknown as CarbonStatementResults).carbon;
    const l = c.latestMonth;
    const saved = c.savedSoFar;
    return {
      ...base,
      businessName: (report.snapshot.resultsJson as unknown as CarbonStatementResults).business
        .name,
      headline: {
        kind: 'carbon_statement' as const,
        period: { from: c.months[0]!.month, to: l.month },
        month: l.month,
        totalT: l.totalT,
        scope2T: l.scope2T,
        scope1T: l.scope1T,
        intensity: l.intensity,
        label: c.label,
        avoidedT: saved ? (saved.verifiedTco2 > 0 ? saved.verifiedTco2 : saved.tco2) : null,
        avoidedVerified: !!saved && saved.verifiedTco2 > 0,
      },
    };
  }
  if (report.type === 'request_pack') {
    const p = report.snapshot.resultsJson as unknown as RequestPackResults;
    return {
      ...base,
      businessName: p.business.name,
      headline: {
        kind: 'request_pack' as const,
        programme: p.programme,
        month: p.latestMonth,
        totalT: p.latestT,
        label: p.label,
        closing: p.closing,
      },
    };
  }
  if (report.type === 'participation_certificate') {
    const c = report.snapshot.resultsJson as unknown as CertificateResults;
    return {
      ...base,
      businessName: c.business.name,
      headline: {
        kind: 'participation_certificate' as const,
        stepTitle: c.step.title,
        runBy: c.step.runBy,
        eventDate: c.eventDate,
        footer: c.footer,
      },
    };
  }
  const r = report.snapshot.resultsJson as unknown as LoanPackResults;
  return {
    ...base,
    businessName: r.business.name,
    headline: {
      kind: 'loan_pack' as const,
      measure: r.measure.title,
      monthlySavingLow: r.measure.savingLow,
      monthlySavingHigh: r.measure.savingHigh,
      emi: Math.round(r.loan.emi),
      netMonthly: Math.round(r.loan.netMonthly),
    },
  };
}
