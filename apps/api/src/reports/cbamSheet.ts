import { createHash, randomUUID } from 'node:crypto';
import { cbamEstimate, footprint, FORMULA_VERSION } from '@ecoproof/calc';
import type { Factor as FactorRow, Site } from '@prisma/client';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { storage } from '../adapters/storage.js';
import { prisma } from '../db.js';
import { DEMO_ORG_IDS } from '../demo/ids.js';
import { AppError } from '../errors.js';
import { factorFor, toCalcFactor } from '../jobs/calculate.js';
import { verifyUrlFor } from './loanPack.js';

/**
 * REP-2 CBAM supplier sheet (Doc 05), shaped by research R4:
 * - iron and steel goods count DIRECT emissions only (Reg. 2023/956 Annex II), so grid
 *   electricity is shown for information and never added to the totals;
 * - the owner picks the CN code (customs decides classification); the app never assigns it;
 * - actual values replace EU defaults only after an accredited verifier checks them.
 */
export const CbamBody = z.object({
  /** First day of the first and last month, e.g. "2025-10-01". Default: last 12 confirmed months. */
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  products: z
    .array(
      z.object({
        cnCode: z.string().trim().min(1).max(20),
        description: z.string().trim().min(1).max(200),
        tonnes: z.number().positive(),
      }),
    )
    .min(1)
    .max(10),
  precursors: z
    .object({
      pigIronTonnes: z.number().nonnegative().optional(),
      scrapTonnes: z.number().nonnegative().optional(),
      preConsumerScrapPct: z.number().min(0).max(100).optional(),
    })
    .optional(),
  language: z.literal('en').default('en'),
});
export type CbamBody = z.infer<typeof CbamBody>;

/** Fixed lines (Doc 05 "Wording and labelling rules", R4 "Legal and loophole checks"). */
export const ESTIMATE_LABEL = 'Estimate, not verified';
export const STATUS_LINE =
  'Estimate, not verified. Verified data must be confirmed by an accredited verifier. Actual values replace EU default values only after that check.';
export const ELECTRICITY_NOTE =
  'For information only: not counted for iron and steel goods under CBAM Annex II.';
export const PRECURSORS_MISSING =
  'Incomplete: precursor emissions (pig iron, purchased steel) are not included.';
export const PURCHASED_STEEL_MISSING =
  'Incomplete: purchased steel precursor emissions are not included.';
export const NOT_IN_SCOPE = 'Not in CBAM scope today (proposed from 2028)';
const NOT_GIVEN = 'not given';
const ROUTE = 'induction furnace';

/** fuel_entries (fuel type, unit) -> factors.source_type. Unmapped fuels are listed, not counted. */
const FUEL_FACTOR: Record<string, string> = {
  'diesel:litre': 'diesel_litre',
  'diesel:kg': 'diesel_kg',
  'lpg:kg': 'lpg_kg',
  'furnace_oil:kg': 'furnace_oil_kg',
  'foundry_coke:kg': 'foundry_coke_kg',
};
const unitKey = (u: string) => {
  const x = u.trim().toLowerCase();
  return ['l', 'litre', 'litres', 'liter', 'liters'].includes(x) ? 'litre' : x;
};

export interface CbamResults {
  kind: 'cbam_sheet';
  reportId: string;
  version: number;
  issuedAt: string;
  isSample: boolean;
  verifyUrl: string;
  period: { from: string; to: string; months: number };
  installation: { operatorName: string; address: string; coordinates: string; contact: string };
  products: Array<{
    cnCode: string;
    cnDescription: string;
    ownerDescription: string;
    tonnes: number;
    inScopeNow: boolean;
    proposedFrom: string | null;
    route: string;
    seeDirect: number;
    embeddedTonnes: number;
    defaultComparison: {
      year: number;
      defaultTotal: number;
      markupPct: number;
      withMarkup: number;
      source: string;
    } | null;
  }>;
  direct: {
    fuels: Array<{
      date: string;
      fuelType: string;
      quantity: number;
      unit: string;
      factorId: string | null;
      factorText: string | null;
      tonnes: number | null;
      note: string | null;
    }>;
    fuelTonnes: number;
    precursorTonnes: number;
    totalTonnes: number;
    outputTonnes: number;
    outputSource: string;
    seeDirect: number;
    defaultSharePct: number;
    precursorNote: string;
  };
  precursors: {
    pigIronTonnes: number | null;
    pigIronFactorText: string | null;
    pigIronEmissions: number | null;
    scrapTonnes: number | null;
  };
  electricity: {
    kwh: number;
    tCo2: number;
    seeIndirectInfo: number;
    factorText: string;
    note: string;
  };
  sector: { scrapPerTonne: number | null; preConsumerScrapPct: number | null };
  factors: Array<{
    id: string;
    sourceType: string;
    value: number;
    unit: string;
    version: string | null;
    status: string;
  }>;
  formulaVersion: string;
  label: typeof ESTIMATE_LABEL;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const r3 = (x: number) => Math.round(x * 1000) / 1000;
const factorText = (f: FactorRow) =>
  `${Number(f.value)} ${f.unit} (${f.sourceType}${f.version ? ` ${f.version}` : ''})`;
/** Factor units are "kg ... per X" or "t ... per X"; footprint() works in kg per unit. */
const kgPerUnit = (f: FactorRow) =>
  f.unit.startsWith('t ') ? Number(f.value) * 1000 : Number(f.value);

export async function buildCbamSnapshot(
  site: Site,
  body: CbamBody,
  ids: { reportId: string; version: number; issuedAt: Date },
) {
  const orgId = site.orgId;
  const org = await prisma.organisation.findFirst({ where: { id: orgId } });
  if (!org) throw new AppError(404, 'NOT_FOUND', 'Organisation not found');

  const codes = await prisma.cbamCnCode.findMany({
    where: { code: { in: body.products.map((p) => p.cnCode) } },
  });
  const byCode = new Map(codes.map((c) => [c.code, c]));
  const unknown = body.products.filter((p) => !byCode.has(p.cnCode)).map((p) => p.cnCode);
  if (unknown.length) {
    throw new AppError(
      400,
      'UNKNOWN_CN_CODE',
      `CN code not in the reference list: ${unknown.join(', ')}`,
    );
  }

  const months = await prisma.energyMonth.findMany({
    where: {
      orgId,
      siteId: site.id,
      ...(body.from || body.to
        ? {
            periodStart: {
              ...(body.from ? { gte: new Date(`${body.from}T00:00:00Z`) } : {}),
              ...(body.to ? { lte: new Date(`${body.to}T00:00:00Z`) } : {}),
            },
          }
        : {}),
    },
    orderBy: { periodStart: 'desc' },
    take: 12,
  });
  if (!months.length) throw new AppError(404, 'NO_BILLS', 'No confirmed bills in this period');
  months.reverse();
  const first = months[0]!;
  const last = months.at(-1)!;

  const [fuels, production, owner] = await Promise.all([
    prisma.fuelEntry.findMany({
      where: { orgId, siteId: site.id, date: { gte: first.periodStart, lte: last.periodEnd } },
      orderBy: { date: 'asc' },
    }),
    prisma.productionMonth.findMany({
      where: { orgId, siteId: site.id, month: { in: months.map((m) => m.periodStart) } },
    }),
    prisma.membership.findFirst({
      where: { orgId, role: 'owner' },
      include: { user: { select: { phone: true } } },
    }),
  ]);

  // Per month: grid factor and fuel factors valid for that period (CALC-1), as in the calculate job.
  const used = new Map<string, FactorRow>();
  const fuelRows: CbamResults['direct']['fuels'] = [];
  let fuelTonnes = 0;
  let kwh = 0;
  let gridTonnes = 0;
  for (const m of months) {
    const grid = await factorFor('grid_electricity_india', m.periodEnd);
    used.set(grid.id, grid);
    const monthFuels = fuels.filter((f) => f.date >= m.periodStart && f.date <= m.periodEnd);
    const counted: Array<{ quantity: number; factor: ReturnType<typeof toCalcFactor> }> = [];
    for (const f of monthFuels) {
      const sourceType = FUEL_FACTOR[`${f.fuelType}:${unitKey(f.unit)}`];
      const qty = Number(f.quantity);
      if (!sourceType) {
        fuelRows.push({
          date: iso(f.date),
          fuelType: f.fuelType,
          quantity: qty,
          unit: f.unit,
          factorId: null,
          factorText: null,
          tonnes: null,
          note: 'no factor for this fuel and unit; not counted',
        });
        continue;
      }
      const factor = await factorFor(sourceType, m.periodEnd);
      used.set(factor.id, factor);
      counted.push({
        quantity: qty,
        factor: { ...toCalcFactor(factor), value: kgPerUnit(factor) },
      });
      fuelRows.push({
        date: iso(f.date),
        fuelType: f.fuelType,
        quantity: qty,
        unit: f.unit,
        factorId: factor.id,
        factorText: factorText(factor),
        tonnes: (qty * kgPerUnit(factor)) / 1000,
        note: null,
      });
    }
    // CBAM is an estimate already, so factors still marked "verify" may be used (and are listed).
    const fp = footprint(
      {
        gridKwh: Number(m.kwh ?? 0),
        fuels: counted,
        outputTonnes: null,
        gridFactor: toCalcFactor(grid),
      },
      { allowUnverified: true },
    );
    fuelTonnes += fp.scope1Tonnes;
    gridTonnes += fp.scope2Tonnes;
    kwh += Number(m.kwh ?? 0);
  }

  const productionTonnes = production.reduce((t, p) => t + Number(p.quantity), 0);
  const productTonnes = body.products.reduce((t, p) => t + p.tonnes, 0);
  const outputTonnes = productionTonnes > 0 ? productionTonnes : productTonnes;
  const outputSource =
    productionTonnes > 0
      ? `all output in the period from production records (${production.length} months)`
      : 'tonnes of the products entered (no production records in the period)';

  // Precursors: pig iron at the EU India default (estimate) only when the owner enters tonnes.
  const pre = body.precursors ?? {};
  let pigFactor: FactorRow | null = null;
  if (pre.pigIronTonnes != null && pre.pigIronTonnes > 0) {
    pigFactor = await factorFor('pig_iron_cbam_india_default', last.periodEnd);
    used.set(pigFactor.id, pigFactor);
  }
  const est = cbamEstimate({
    scope1AttributedTonnes: fuelTonnes,
    precursors: pigFactor
      ? [{ tonnes: pre.pigIronTonnes!, see: Number(pigFactor.value), isDefault: true }]
      : [],
    scope2Tonnes: gridTonnes,
    outputTonnes,
  });
  const pigIronEmissions = pigFactor ? pre.pigIronTonnes! * Number(pigFactor.value) : null;

  const year = ids.issuedAt.getUTCFullYear();
  const markup = await prisma.cbamMarkup.findFirst({
    where: { yearFrom: { lte: year } },
    orderBy: { yearFrom: 'desc' },
  });

  const products: CbamResults['products'] = body.products.map((p) => {
    const c = byCode.get(p.cnCode)!;
    const def = c.indiaDefaultTotal == null ? null : Number(c.indiaDefaultTotal);
    const pct = markup ? Number(markup.pct) : null;
    return {
      cnCode: c.code,
      cnDescription: c.description,
      ownerDescription: p.description,
      tonnes: p.tonnes,
      inScopeNow: c.inScopeNow,
      proposedFrom: c.proposedFrom ? iso(c.proposedFrom) : null,
      route: ROUTE,
      seeDirect: est.seeDirect,
      embeddedTonnes: est.seeDirect * p.tonnes,
      defaultComparison:
        def != null && pct != null
          ? {
              year,
              defaultTotal: def,
              markupPct: pct,
              withMarkup: r3(def * (1 + pct / 100)),
              source: c.source,
            }
          : null,
    };
  });

  const scrapPerTonne =
    pre.scrapTonnes != null && outputTonnes > 0 ? pre.scrapTonnes / outputTonnes : null;
  const factors = [...used.values()];
  const resultsJson: CbamResults = {
    kind: 'cbam_sheet',
    reportId: ids.reportId,
    version: ids.version,
    issuedAt: ids.issuedAt.toISOString(),
    isSample: DEMO_ORG_IDS.includes(orgId),
    verifyUrl: verifyUrlFor(ids.reportId),
    period: { from: iso(first.periodStart), to: iso(last.periodEnd), months: months.length },
    installation: {
      operatorName: org.name,
      address: site.address ?? NOT_GIVEN,
      coordinates:
        site.lat != null && site.lng != null
          ? `${Number(site.lat)}, ${Number(site.lng)}`
          : NOT_GIVEN,
      contact: owner?.user.phone ?? NOT_GIVEN,
    },
    products,
    direct: {
      fuels: fuelRows,
      fuelTonnes,
      precursorTonnes: pigIronEmissions ?? 0,
      totalTonnes: fuelTonnes + (pigIronEmissions ?? 0),
      outputTonnes,
      outputSource,
      seeDirect: est.seeDirect,
      defaultSharePct: est.defaultSharePct,
      precursorNote: pigFactor ? PURCHASED_STEEL_MISSING : PRECURSORS_MISSING,
    },
    precursors: {
      pigIronTonnes: pre.pigIronTonnes ?? null,
      pigIronFactorText: pigFactor ? `${factorText(pigFactor)}, based on EU default value` : null,
      pigIronEmissions,
      scrapTonnes: pre.scrapTonnes ?? null,
    },
    electricity: {
      kwh,
      tCo2: gridTonnes,
      seeIndirectInfo: est.seeIndirectInfo,
      factorText: factors
        .filter((f) => f.sourceType === 'grid_electricity_india')
        .map(factorText)
        .join('; '),
      note: ELECTRICITY_NOTE,
    },
    sector: { scrapPerTonne, preConsumerScrapPct: pre.preConsumerScrapPct ?? null },
    factors: factors.map((f) => ({
      id: f.id,
      sourceType: f.sourceType,
      value: Number(f.value),
      unit: f.unit,
      version: f.version,
      status: f.status,
    })),
    formulaVersion: FORMULA_VERSION,
    label: ESTIMATE_LABEL,
  };

  return {
    inputsJson: {
      months: months.map((m) => m.id),
      fuelEntries: fuels.map((f) => f.id),
      productionMonths: production.map((p) => p.id),
      body,
    },
    resultsJson,
    factorIds: factors.map((f) => f.id),
    formulaVersion: FORMULA_VERSION,
  };
}

// ---------------------------------------------------------------- Excel

const fmt = (x: number | null, dp = 3) => (x == null ? NOT_GIVEN : Number(x.toFixed(dp)));
const dateText = (isoTs: string) =>
  new Date(isoTs).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

/** Seven tabs in the Annex IV order (IR 2025/2547), every one headed "Estimate, not verified". */
export async function renderCbamXlsx(r: CbamResults, snapshotId: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'EcoProof';
  wb.created = new Date(r.issuedAt);
  wb.modified = new Date(r.issuedAt);

  const sheet = (name: string, title: string) => {
    const ws = wb.addWorksheet(name);
    ws.columns = [
      { width: 44 },
      { width: 28 },
      { width: 22 },
      { width: 22 },
      { width: 22 },
      { width: 22 },
      { width: 40 },
    ];
    ws.addRow([ESTIMATE_LABEL]).font = { bold: true, color: { argb: 'FFB45309' } };
    ws.addRow([title]).font = { bold: true, size: 13 };
    ws.addRow([
      `CBAM supplier sheet · Report ${r.reportId} · version ${r.version} · issued ${dateText(r.issuedAt)}${r.isSample ? ' · Sample data (synthetic)' : ''}`,
    ]);
    ws.addRow([]);
    return ws;
  };
  const head = (ws: ExcelJS.Worksheet, cells: string[]) => {
    ws.addRow(cells).font = { bold: true };
  };

  // 1 Installation
  const s1 = sheet('1 Installation', '1. Identification of operator and installation');
  s1.addRows([
    ['Operator / installation name', r.installation.operatorName],
    ['Address', r.installation.address],
    ['Geo-coordinates of main emission source', r.installation.coordinates],
    ['Contact', r.installation.contact],
    ['CBAM Registry installation ID', NOT_GIVEN],
    ['Reporting period', `${r.period.from} to ${r.period.to} (${r.period.months} months)`],
    ['Language', 'English (Art. 10(4), IR 2025/2547)'],
  ]);

  // 2 Goods and route
  const s2 = sheet('2 Goods and route', '2. Goods and production route');
  s2.addRow([
    'The owner chose each CN code. Classification is for the importer and customs to confirm.',
  ]);
  head(s2, [
    'Description (owner)',
    'CN code',
    'CN description',
    'In CBAM scope now',
    'Production route',
    'Note',
  ]);
  for (const p of r.products) {
    s2.addRow([
      p.ownerDescription,
      p.cnCode,
      p.cnDescription,
      p.inScopeNow ? 'Y' : 'N',
      p.route,
      p.inScopeNow ? '' : `${NOT_IN_SCOPE}; proposal COM(2025) 989, not yet adopted`,
    ]);
  }

  // 3 Direct emissions
  const s3 = sheet('3 Direct emissions', '3. Direct emissions (fuel combustion and precursors)');
  head(s3, ['Date', 'Fuel', 'Quantity', 'Unit', 'Factor', 't CO2e', 'Note']);
  if (!r.direct.fuels.length) s3.addRow(['-', 'No fuel entries in the period', 0, '', '', 0, '']);
  for (const f of r.direct.fuels) {
    s3.addRow([
      f.date,
      f.fuelType,
      f.quantity,
      f.unit,
      f.factorText ?? '-',
      f.tonnes == null ? '-' : fmt(f.tonnes),
      f.note ?? '',
    ]);
  }
  s3.addRow([]);
  s3.addRows([
    ['Fuel combustion, t CO2e', fmt(r.direct.fuelTonnes)],
    [
      'Precursors: pig iron, t',
      r.precursors.pigIronTonnes == null ? 'not entered' : fmt(r.precursors.pigIronTonnes),
    ],
    ['Precursors: pig iron factor', r.precursors.pigIronFactorText ?? 'not entered'],
    [
      'Precursors: pig iron, t CO2e',
      r.precursors.pigIronEmissions == null ? 'not entered' : fmt(r.precursors.pigIronEmissions),
    ],
    ['Precursors: purchased steel', 'not entered'],
    [r.direct.precursorNote],
    [],
    ['Total direct emissions in the period, t CO2e', fmt(r.direct.totalTonnes)],
    ['Output used for per-tonne values, t', fmt(r.direct.outputTonnes), r.direct.outputSource],
    ['Specific direct embedded emissions, t CO2e per t of product', fmt(r.direct.seeDirect)],
    [
      'Share of direct emissions resting on EU default values',
      `${fmt(r.direct.defaultSharePct, 1)}%`,
    ],
  ]);
  s3.addRow([]);
  head(s3, ['Product', 'CN code', 'Tonnes', 't CO2e per t', 'Embedded t CO2e']);
  for (const p of r.products) {
    s3.addRow([p.ownerDescription, p.cnCode, p.tonnes, fmt(p.seeDirect), fmt(p.embeddedTonnes)]);
  }

  // 4 Electricity
  const s4 = sheet('4 Electricity', '4. Electricity (indirect)');
  s4.addRow([ELECTRICITY_NOTE]).font = { bold: true };
  s4.addRows([
    ['Grid electricity, kWh', fmt(r.electricity.kwh, 0)],
    ['Grid electricity, t CO2 (location-based, CEA)', fmt(r.electricity.tCo2)],
    ['Grid factor', r.electricity.factorText],
    ['Indirect, t CO2 per t of output (information only)', fmt(r.electricity.seeIndirectInfo)],
    ['Counted in the direct total above', 'No'],
  ]);

  // 5 Sector parameters
  const s5 = sheet('5 Sector parameters', '5. Sector parameters: iron or steel products');
  s5.addRows([
    [
      'Tonnes of scrap used per t of product',
      r.sector.scrapPerTonne == null ? NOT_GIVEN : fmt(r.sector.scrapPerTonne),
    ],
    [
      '% of scrap that is pre-consumer scrap',
      r.sector.preConsumerScrapPct == null ? NOT_GIVEN : `${fmt(r.sector.preConsumerScrapPct, 1)}%`,
    ],
    ['Main reducing agent used in precursor production', NOT_GIVEN],
    ['Mass % of Mn, Cr, Ni, other alloy elements', NOT_GIVEN],
  ]);

  // 6 EU default comparison
  const s6 = sheet('6 EU default comparison', '6. EU default value comparison (India)');
  s6.addRow([
    'This does not compare the default with your estimate: precursor emissions are missing, so a lower estimate here would not mean lower real emissions.',
  ]);
  head(s6, ['CN code', 'Default, t CO2e per t', 'Mark-up', 'Default with mark-up', 'Year', 'Line']);
  for (const p of r.products) {
    const d = p.defaultComparison;
    if (!d) {
      s6.addRow([
        p.cnCode,
        '-',
        '-',
        '-',
        '-',
        p.inScopeNow ? 'No India default for this code in the source table' : NOT_IN_SCOPE,
      ]);
      continue;
    }
    s6.addRow([
      p.cnCode,
      d.defaultTotal,
      `${d.markupPct}%`,
      d.withMarkup,
      d.year,
      `If no verifier-checked data is sent, your EU buyer uses the default: ${d.defaultTotal.toFixed(3)} t CO2e/t + ${d.markupPct}% mark-up in ${d.year} = ${d.withMarkup.toFixed(3)}. Based on EU default value.`,
    ]);
  }
  s6.addRow([]);
  s6.addRow([
    'Source: IR (EU) 2025/2621 Annex I, India, iron and steel, total column, as corrected by IR (EU) 2026/1740. The mark-up applies to the total.',
  ]);

  // 7 Status
  const s7 = sheet('7 Status', '7. Status');
  s7.addRow([STATUS_LINE]).font = { bold: true };
  s7.addRows([
    [
      "Unverified data cannot lower the importer's cost; without a verifier check the importer uses the EU default with the mark-up.",
    ],
    [
      'Importers bringing in less than 50 tonnes of CBAM goods a year may be exempt (de minimis, Art. 2a).',
    ],
    ['Carbon price paid in India: none entered.'],
    [],
    ['Snapshot ID', snapshotId],
    ['Formula version', r.formulaVersion],
    ['Verify page', r.verifyUrl],
  ]);
  s7.addRow([]);
  head(s7, ['Factor', 'Value', 'Unit', 'Version', 'Status', 'ID']);
  for (const f of r.factors)
    s7.addRow([f.sourceType, f.value, f.unit, f.version ?? '-', f.status, f.id]);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ---------------------------------------------------------------- pipeline

const sha256 = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Doc 05 steps 2-4 for the CBAM sheet: snapshot, render, seal, store. New sheet = version n+1. */
export async function createCbamSheet(site: Site, body: CbamBody) {
  const orgId = site.orgId;
  const previous = await prisma.report.count({
    where: { orgId, snapshot: { siteId: site.id, type: 'cbam_sheet' } },
  });
  const ids = { reportId: randomUUID(), version: previous + 1, issuedAt: new Date() };
  const snapshotId = randomUUID();

  const snap = await buildCbamSnapshot(site, body, ids);
  const xlsx = await renderCbamXlsx(snap.resultsJson, snapshotId);
  const seal = sha256(xlsx);
  const fileKey = `reports/${orgId}/${ids.reportId}.xlsx`;
  await storage.put(fileKey, xlsx, XLSX_MIME);

  await prisma.$transaction([
    prisma.reportSnapshot.create({
      data: {
        id: snapshotId,
        orgId,
        siteId: site.id,
        type: 'cbam_sheet',
        language: body.language,
        inputsJson: snap.inputsJson,
        resultsJson: snap.resultsJson as object,
        factorIds: snap.factorIds,
        formulaVersion: snap.formulaVersion,
        createdAt: ids.issuedAt,
      },
    }),
    prisma.report.create({
      data: {
        id: ids.reportId,
        orgId,
        snapshotId,
        type: 'cbam_sheet',
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
