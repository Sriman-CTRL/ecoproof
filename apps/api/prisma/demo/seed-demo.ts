// SYNTHETIC DEMO DATA - not a real unit or bill. Every non-doc number lives in assumptions.json.
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Prisma, type Factor as FactorRow } from '@prisma/client';
import {
  domesticBill,
  netBilledUnits,
  fitBaseline,
  footprint,
  monthlySavings,
  savingsStatus,
  type Baseline,
} from '@ecoproof/calc';
import {
  DEMO_CARBON_STATEMENT_ID,
  DEMO_ORG_IDS,
  DEMO_REPORT_ID,
  ORG_A,
  ORG_B,
  ORG_H,
  SITE_A,
  SITE_B,
  SITE_H,
  USER_A,
  USER_B,
  USER_H,
} from '../../src/demo/ids.js';
import { storage } from '../../src/adapters/storage.js';
import { prisma } from '../../src/db.js';
import { pickFactor, toCalcFactor } from '../../src/jobs/calculate.js';
import { DOMESTIC_PRICING_LABEL, loadDomesticTariff } from '../../src/services/domesticTariff.js';
import { createCarbonStatement } from '../../src/reports/carbonStatement.js';
import { createLoanPack } from '../../src/reports/loanPack.js';
import { pdfRenderer } from '../../src/reports/pdfRenderer.js';

// ---- fixed demo identifiers (the only rows --reset may delete are those with these org ids)
export { ORG_A, ORG_B, ORG_H, DEMO_ORG_IDS };

const A = JSON.parse(
  readFileSync(new URL('./assumptions.json', import.meta.url), 'utf8'),
) as Record<string, number | string | null>;
const num = (k: string): number => {
  const v = A[k];
  if (typeof v !== 'number') throw new Error(`assumptions.json: ${k} must be a number`);
  return v;
};

const BASE_P = [80, 85, 90, 95, 100, 105, 110, 115, 90, 95, 100, 105];
const BASE_KWH = [
  74500, 78600, 82300, 86800, 90400, 93700, 98900, 102100, 81800, 86300, 90900, 94200,
];
const AFTER_P = [100, 105, 95, 110, 100, 105];
const BASELINE_RULES = { minMonthsForRegression: 9, maxCvRmsePct: 15, maxAbsNmbePct: 5 };
const FORMULA_NOTE = 'SYNTHETIC';

/** Deterministic UUID from a key, so child rows upsert by id. */
function det(key: string): string {
  const h = createHash('sha1').update(`ecoproof-demo:${key}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const r2 = (n: number) => Math.round(n * 100) / 100;
type Tag = 'A' | 'B';
/**
 * Demo A: i=0 -> Oct 2025, 12 bills to Sep 2026. Demo B runs 6 months earlier (i=0 -> Apr 2025,
 * 18 bills to Sep 2026), so no demo bill falls after demo day (13 Oct 2026). Same values; row ids
 * key on i, so they survive the shift.
 */
const SHIFT: Record<Tag, number> = { A: 0, B: -6 };
const monthStart = (i: number, tag: Tag) => new Date(Date.UTC(2025, 9 + SHIFT[tag] + i, 1));
const monthEnd = (i: number, tag: Tag) => new Date(Date.UTC(2025, 10 + SHIFT[tag] + i, 0));

interface MonthRow {
  i: number;
  p: number;
  kwh: number;
  kvah: number;
  pf: number;
}

function monthRows(withAfter: boolean, baseline?: { a: number; b: number }): MonthRow[] {
  const pfBefore = num('pfBefore');
  const rows: MonthRow[] = BASE_P.map((p, i) => ({
    i,
    p,
    kwh: BASE_KWH[i]!,
    kvah: r2(BASE_KWH[i]! / pfBefore),
    pf: pfBefore,
  }));
  if (withAfter && baseline) {
    const gain = 1 - num('efficiencyGainAfterPct') / 100;
    AFTER_P.forEach((p, j) => {
      const kwh = Math.round((baseline.a + baseline.b * p) * gain);
      rows.push({ i: 12 + j, p, kwh, kvah: r2(kwh / num('pfAfter')), pf: num('pfAfter') });
    });
  }
  return rows;
}

/**
 * CALC-1 per bill month: each month uses the factor valid for its period (e.g. CEA v22.0 FY
 * rows). Rows are loaded once per source type; the remote DB makes a query per month slow.
 */
const factorRows = new Map<string, Promise<FactorRow[]>>();
async function factorAt(sourceType: string, periodEnd: Date) {
  if (!factorRows.has(sourceType)) {
    factorRows.set(sourceType, prisma.factor.findMany({ where: { sourceType } }));
  }
  const row = pickFactor(await factorRows.get(sourceType)!, periodEnd);
  if (!row)
    throw new Error(`No ${sourceType} factor valid for ${periodEnd.toISOString()}: run db:seed`);
  return toCalcFactor(row);
}

async function seedOrg(opts: {
  orgId: string;
  siteId: string;
  userId: string;
  name: string;
  phone: string;
  rows: MonthRow[];
  withAfter: boolean;
}) {
  const { orgId, siteId, userId, name, phone, rows } = opts;
  const tag: Tag = orgId === ORG_A ? 'A' : 'B';
  const k = (s: string) => det(`${tag}:${s}`);
  const cd = num('contractedDemandKva');
  const md = num('mdKva');
  const billedMd = Math.max(md, 0.8 * cd);

  // SYNTHETIC profile for the scheme matcher (FIN-1): not a real business.
  const profile = {
    udyamCategory: 'small',
    yearsInOperation: 12,
    gstRegistered: true,
    cashProfitsLast2y: true,
    commencedOn: new Date('2014-04-01T00:00:00Z'),
    womenOwned: false,
    scStOwned: false,
  };
  await prisma.organisation.upsert({
    where: { id: orgId },
    update: { name, ...profile },
    create: {
      id: orgId,
      type: 'msme',
      name,
      udyamNo: 'UDYAM-SAMPLE-0001',
      gstin: null,
      sector: 'foundry',
      state: 'Telangana',
      ...profile,
    },
  });
  const siteData = {
    orgId,
    address: 'Balanagar, Hyderabad (SYNTHETIC sample)',
    lat: null,
    lng: null,
    discom: 'TGSPDCL',
    consumerNo: 'SAMPLE-HT-0001',
    tariffCategory: 'HT-I(A)',
    contractedDemandKva: cd,
    sanctionedLoadKw: num('sanctionedLoadKw'),
  };
  await prisma.site.upsert({
    where: { id: siteId },
    update: siteData,
    create: { id: siteId, ...siteData },
  });
  await prisma.user.upsert({
    where: { id: userId },
    update: { phone, language: 'en' },
    create: { id: userId, phone, language: 'en' },
  });
  await prisma.membership.upsert({
    where: { userId_orgId: { userId, orgId } },
    update: { role: 'owner' },
    create: { id: k('membership'), userId, orgId, role: 'owner' },
  });
  await prisma.consent.upsert({
    where: { id: k('consent') },
    update: {},
    create: {
      id: k('consent'),
      orgId,
      userId,
      noticeVersion: 'v0-demo',
      purpose: 'processing',
      grantedAt: new Date('2025-10-01T00:00:00Z'),
    },
  });

  const rate = num('energyRatePerKvah');
  const resultsRows: Prisma.ResultUncheckedCreateInput[] = [];
  for (const m of rows) {
    const start = monthStart(m.i, tag);
    const energyCharges = r2(m.kvah * rate);
    const demandCharges = r2(billedMd * num('demandRatePerKva'));
    const emId = k(`em:${m.i}`);
    const emData = {
      orgId,
      siteId,
      periodEnd: monthEnd(m.i, tag),
      kwh: m.kwh,
      kvah: m.kvah,
      pf: m.pf,
      mdKva: md,
      peakKwh: r2((m.kwh * num('peakSharePct')) / 100),
      solarHoursKwh: null,
      energyCharges,
      demandCharges,
      otherChargesJson: {
        customer_charge: num('customerChargePerMonth'),
        low_pf_surcharge: 0,
        _label: 'SYNTHETIC',
      },
      qualityTag: 'measured' as const,
    };
    await prisma.energyMonth.upsert({
      where: { id: emId },
      update: { periodStart: start, ...emData },
      create: { id: emId, periodStart: start, ...emData },
    });
    const fuelId = k(`fuel:${m.i}`);
    const fuelData = {
      orgId,
      siteId,
      date: start,
      fuelType: 'diesel',
      quantity: num('dieselLitresPerMonth'),
      unit: 'litre',
      qualityTag: 'owner_entered' as const,
    };
    await prisma.fuelEntry.upsert({
      where: { id: fuelId },
      update: fuelData,
      create: { id: fuelId, ...fuelData },
    });
    const prodId = k(`prod:${m.i}`);
    const prodData = {
      orgId,
      siteId,
      quantity: m.p,
      unit: 'tonne',
      qualityTag: 'owner_entered' as const,
    };
    await prisma.productionMonth.upsert({
      where: { id: prodId },
      update: { month: start, ...prodData },
      create: { id: prodId, month: start, ...prodData },
    });

    const fp = footprint({
      gridKwh: m.kwh,
      fuels: [
        {
          quantity: num('dieselLitresPerMonth'),
          factor: await factorAt('diesel_litre', monthEnd(m.i, tag)),
        },
      ],
      outputTonnes: m.p,
      gridFactor: await factorAt('grid_electricity_india', monthEnd(m.i, tag)),
    });
    resultsRows.push({
      id: k(`result:${m.i}`),
      orgId,
      siteId,
      month: start,
      scope1: fp.scope1Tonnes,
      scope2: fp.scope2Tonnes,
      scope3Metals: null,
      intensity: fp.intensityTPerTonne,
      factorIds: fp.factorIds,
      formulaVersion: fp.formulaVersion,
      inputIds: [emId, fuelId, prodId],
    });
  }
  for (const r of resultsRows) {
    const { id, ...rest } = r;
    await prisma.result.upsert({ where: { id: id! }, update: rest, create: r });
  }
  void FORMULA_NOTE;
}

export async function seedDemo(opts: { demoReport?: boolean } = {}) {
  factorRows.clear();
  const baseline: Baseline = fitBaseline({
    months: BASE_P.map((p, i) => ({ productionTonnes: p, kwh: BASE_KWH[i]! })),
    rules: BASELINE_RULES,
  });

  await seedOrg({
    orgId: ORG_A,
    siteId: SITE_A,
    userId: USER_A,
    phone: '+91-SAMPLE-0001',
    name: 'Sri Lakshmi Castings (sample)',
    rows: monthRows(false),
    withAfter: false,
  });
  const rowsB = monthRows(true, baseline);
  await seedOrg({
    orgId: ORG_B,
    siteId: SITE_B,
    userId: USER_B,
    phone: '+91-SAMPLE-0002',
    name: 'Sri Lakshmi Castings (sample, after the fixes)',
    rows: rowsB,
    withAfter: true,
  });

  // ---- Demo B: baseline, actions, savings ledger
  const kb = (s: string) => det(`B:${s}`);
  const baseData = {
    orgId: ORG_B,
    siteId: SITE_B,
    start: monthStart(0, 'B'),
    end: monthEnd(11, 'B'),
    a: baseline.a,
    b: baseline.b,
    cvRmse: baseline.cvRmsePct,
    nmbe: baseline.nmbePct,
    method: baseline.method,
  };
  await prisma.baseline.upsert({
    where: { id: kb('baseline') },
    update: baseData,
    create: { id: kb('baseline'), ...baseData },
  });

  const pfAction = await prisma.actionLibrary.findUnique({ where: { code: 'fix_power_factor' } });
  const effAction = await prisma.actionLibrary.findUnique({ where: { code: 'igbt_furnace' } });
  if (!pfAction || !effAction) throw new Error('actions missing: run db:seed first');
  // The pre-R2 placeholder row is retired, not deleted (reference rows keep their IDs).
  await prisma.actionLibrary.updateMany({
    where: { code: 'efficiency_measure_pending_r2' },
    data: {
      status: 'retired',
      source: 'SYNTHETIC DEMO placeholder, retired in S8c: replaced by igbt_furnace (research R2)',
    },
  });
  const doneAt = monthEnd(11, 'B'); // end of the baseline: 31 Mar 2026
  for (const [key, actionId] of [
    ['pf', pfAction.id],
    ['eff', effAction.id],
  ] as const) {
    const d = { orgId: ORG_B, siteId: SITE_B, actionId, status: 'done', doneAt, actualCost: null };
    await prisma.siteAction.upsert({
      where: { id: kb(`action:${key}`) },
      update: d,
      create: { id: kb(`action:${key}`), ...d },
    });
  }

  // Ledger: the kWh saving is credited to the IGBT furnace (PF fix saves kVAh, not kWh). The
  // SYNTHETIC 6% gain sits inside the sourced 5.7-7.0% of site kWh (8.2% x 70-85% furnace share).
  let cumulative = 0;
  for (const m of rowsB.filter((r) => r.i >= 12)) {
    const energyCharges = m.kvah * num('energyRatePerKvah');
    const s = monthlySavings({
      baseline,
      productionTonnes: m.p,
      actualKwh: m.kwh,
      effectiveRatePerKwh: energyCharges / m.kwh,
      gridFactor: await factorAt('grid_electricity_india', monthEnd(m.i, 'B')),
    });
    cumulative += s.savedKwh;
    const status = savingsStatus({
      baseline,
      cumulativeSavedKwh: cumulative,
      reportingMonths: m.i - 11,
    });
    const d = {
      orgId: ORG_B,
      siteId: SITE_B,
      month: monthStart(m.i, 'B'),
      actionId: effAction.id,
      kwhSaved: r2(s.savedKwh),
      inrSaved: r2(s.inrSaved),
      co2Saved: Math.round(s.co2SavedTonnes * 1000) / 1000,
      status: status === 'verified' ? ('verified' as const) : ('early' as const),
    };
    await prisma.savingsLedger.upsert({
      where: { id: kb(`ledger:${m.i}`) },
      update: d,
      create: { id: kb(`ledger:${m.i}`), ...d },
    });
  }

  await seedHousehold();
  if (opts.demoReport ?? true) {
    await seedDemoReport();
    await seedDemoCarbonStatement();
  }
}

// ---- Demo H: a sample home (HH-1). SYNTHETIC bills, none after Sep 2026 (demo day 13 Oct 2026).
const H_BEFORE_KWH = [420, 450, 400, 330, 300, 290, 280, 250, 230, 240, 290, 360]; // Apr 2025 - Mar 2026
const H_IMPORT_KWH = [210, 230, 220, 190, 170, 160]; // Apr - Sep 2026, after 3 kW solar
const H_EXPORT_KWH = [190, 190, 140, 140, 150, 170];
const hStart = (i: number) => new Date(Date.UTC(2025, 3 + i, 1)); // i=0 -> Apr 2025
const hEnd = (i: number) => new Date(Date.UTC(2025, 4 + i, 0));

async function seedHousehold() {
  const k = (s: string) => det(`H:${s}`);
  const orgId = ORG_H;
  const siteId = SITE_H;
  const userId = USER_H;
  // No Udyam, sector or business profile for a household (HH-1).
  const org = {
    type: 'household' as const,
    name: 'Sample home, Hyderabad (synthetic)',
    state: 'Telangana',
  };
  await prisma.organisation.upsert({
    where: { id: orgId },
    update: org,
    create: { id: orgId, ...org },
  });
  const siteData = {
    orgId,
    address: 'Hyderabad (SYNTHETIC sample home)',
    discom: 'TGSPDCL',
    consumerNo: 'SAMPLE-LT-0001',
    tariffCategory: 'LT-I',
    sanctionedLoadKw: num('householdSanctionedLoadKw'),
    roofAreaM2: num('householdRoofAreaM2'),
  };
  await prisma.site.upsert({
    where: { id: siteId },
    update: siteData,
    create: { id: siteId, ...siteData },
  });
  await prisma.user.upsert({
    where: { id: userId },
    update: { phone: '+91-SAMPLE-0003', language: 'en' },
    create: { id: userId, phone: '+91-SAMPLE-0003', language: 'en' },
  });
  await prisma.membership.upsert({
    where: { userId_orgId: { userId, orgId } },
    update: { role: 'owner' },
    create: { id: k('membership'), userId, orgId, role: 'owner' },
  });
  await prisma.consent.upsert({
    where: { id: k('consent') },
    update: {},
    create: {
      id: k('consent'),
      orgId,
      userId,
      noticeVersion: 'v0-demo',
      purpose: 'processing',
      grantedAt: new Date('2025-04-01T00:00:00Z'),
    },
  });

  // Every Demo H month, before and after solar, is priced with domesticBill at the FY 2026-27
  // LT-I rates (TGERC RST Order, R9), so the before/after comparison is not distorted by a tariff
  // change: "priced at FY 2026-27 LT-I rates (synthetic bills)". FSA and duty are not included.
  const { tariff, ruleIds } = await loadDomesticTariff();
  const sanctionedKw = num('householdSanctionedLoadKw');
  const kwp = num('householdSolarInstalledKwp');
  const rows = [
    ...H_BEFORE_KWH.map((kwh, i) => ({ i, importKwh: kwh, exportKwh: null as number | null })),
    ...H_IMPORT_KWH.map((kwh, j) => ({ i: 12 + j, importKwh: kwh, exportKwh: H_EXPORT_KWH[j]! })),
  ];
  // Rows are independent: upsert them in parallel (the remote DB makes a query per row slow).
  const seedRow = async (m: (typeof rows)[number]) => {
    // TGERC order para 3.30.4: billed units and slab group use import minus export for the
    // month; excess export is settled at a rate we do not have, so it is not counted.
    const billedKwh = netBilledUnits(m.importKwh, m.exportKwh, tariff.netMetering);
    const bill = domesticBill({ units: billedKwh, sanctionedLoadKw: sanctionedKw, tariff });
    const emId = k(`em:${m.i}`);
    const emData = {
      orgId,
      siteId,
      periodEnd: hEnd(m.i),
      kwh: m.importKwh,
      exportKwh: m.exportKwh,
      solarInstalledKwp: m.exportKwh == null ? null : kwp,
      energyCharges: bill.energyInr,
      otherChargesJson: {
        _label: 'SYNTHETIC',
        pricing: DOMESTIC_PRICING_LABEL,
        billedKwh,
        group: bill.group,
        bill: {
          energyInr: bill.energyInr,
          fixedInr: bill.fixedInr,
          customerInr: bill.customerInr,
          totalInr: bill.totalInr,
        },
        tariffRuleIds: ruleIds,
      },
      qualityTag: 'measured' as const,
    };
    await prisma.energyMonth.upsert({
      where: { id: emId },
      update: emData,
      create: { id: emId, periodStart: hStart(m.i), ...emData },
    });
    // Doc 03 Scope 2: grid kWh = imported kWh; exported units are not subtracted.
    const fp = footprint({
      gridKwh: m.importKwh,
      fuels: [],
      outputTonnes: null,
      gridFactor: await factorAt('grid_electricity_india', hEnd(m.i)),
    });
    const resultId = k(`result:${m.i}`);
    const result = {
      orgId,
      siteId,
      scope1: null,
      scope2: fp.scope2Tonnes,
      scope3Metals: null,
      intensity: null,
      factorIds: fp.factorIds,
      formulaVersion: fp.formulaVersion,
      inputIds: [emId],
    };
    await prisma.result.upsert({
      where: { id: resultId },
      update: result,
      create: { id: resultId, month: hStart(m.i), ...result },
    });
  };
  await Promise.all(rows.map(seedRow));
}

/**
 * One loan-ready summary for Demo B's power factor fix, through the real pipeline, under a fixed
 * id: the landing page QR points at /verify/<id>. Built from the 12 baseline months (to Mar 2026),
 * the last bills where the finding was still flagged; the fix is marked done.
 */
async function seedDemoReport() {
  const site = await prisma.site.findFirstOrThrow({ where: { id: SITE_B, orgId: ORG_B } });
  const old = { id: DEMO_REPORT_ID, orgId: ORG_B };
  const existing = await prisma.report.findFirst({ where: old });
  if (existing) {
    const shares = { reportId: existing.id, orgId: ORG_B };
    await prisma.$transaction([
      prisma.shareView.deleteMany({ where: { orgId: ORG_B, share: shares } }),
      prisma.share.deleteMany({ where: shares }),
      prisma.report.deleteMany({ where: old }),
      prisma.reportSnapshot.deleteMany({ where: { id: existing.snapshotId, orgId: ORG_B } }),
    ]);
  }
  await createLoanPack(
    site,
    {
      actionCode: 'fix_power_factor',
      quote: { vendorName: 'Sample Capacitors (synthetic)', amountInr: 250000 },
      loan: { amountInr: 1000000, ratePct: 8, tenureMonths: 60 },
      language: 'en',
    },
    { reportId: DEMO_REPORT_ID, asOfMonth: monthStart(11, 'B') },
  );

  // Demo B shared that summary with a sample lender, who opened it twice: real rows, so the
  // progress path reaches "Finance-ready" from data. The raw token is never stored (or known).
  const kb = (s: string) => det(`B:${s}`);
  const shareId = kb('share:sample-bank');
  const shareData = {
    orgId: ORG_B,
    reportId: DEMO_REPORT_ID,
    recipient: 'Sample Bank (sample)',
    tokenHash: createHash('sha256').update(kb('share-token')).digest('hex'),
    // Same 30-day default as POST /reports/:id/shares.
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    revokedAt: null,
  };
  await prisma.share.upsert({
    where: { id: shareId },
    update: shareData,
    create: { id: shareId, ...shareData },
  });
  for (const i of [1, 2]) {
    const d = { orgId: ORG_B, shareId, kind: 'view', userAgent: 'Sample (synthetic)' };
    await prisma.shareView.upsert({
      where: { id: kb(`share-view:${i}`) },
      update: d,
      create: { id: kb(`share-view:${i}`), ...d },
    });
  }
}

/** Demo A's carbon statement under the fixed pitch-deck id (Oct 2025 - Sep 2026 bills). */
async function seedDemoCarbonStatement() {
  const site = await prisma.site.findFirstOrThrow({ where: { id: SITE_A, orgId: ORG_A } });
  const old = { id: DEMO_CARBON_STATEMENT_ID, orgId: ORG_A };
  const existing = await prisma.report.findFirst({ where: old });
  if (existing) {
    const shares = { reportId: existing.id, orgId: ORG_A };
    await prisma.$transaction([
      prisma.shareView.deleteMany({ where: { orgId: ORG_A, share: shares } }),
      prisma.share.deleteMany({ where: shares }),
      prisma.report.deleteMany({ where: old }),
      prisma.reportSnapshot.deleteMany({ where: { id: existing.snapshotId, orgId: ORG_A } }),
    ]);
  }
  await createCarbonStatement(site, { language: 'en' }, { reportId: DEMO_CARBON_STATEMENT_ID });
}

export async function resetDemo() {
  const where = { orgId: { in: DEMO_ORG_IDS } };
  // D7 Mitra: steps are never seeded; their proof files and Mitra PDFs go with them.
  const [steps, mitraReports] = await Promise.all([
    prisma.mitraStep.findMany({ where, select: { proofFileKey: true } }),
    prisma.report.findMany({
      where: { ...where, type: { in: ['request_pack', 'participation_certificate'] } },
      select: { fileKey: true },
    }),
  ]);
  await prisma.$transaction([
    prisma.mitraStep.deleteMany({ where }),
    prisma.savingsLedger.deleteMany({ where }),
    prisma.siteAction.deleteMany({ where }),
    prisma.baseline.deleteMany({ where }),
    prisma.result.deleteMany({ where }),
    prisma.productionMonth.deleteMany({ where }),
    prisma.fuelEntry.deleteMany({ where }),
    prisma.energyMonth.deleteMany({ where }),
    prisma.nonRoutineAdjustment.deleteMany({ where }),
    prisma.siteEquipment.deleteMany({ where }),
    prisma.extraction.deleteMany({ where }),
    prisma.document.deleteMany({ where }),
    prisma.shareView.deleteMany({ where }),
    prisma.share.deleteMany({ where }),
    prisma.report.deleteMany({ where }),
    prisma.reportSnapshot.deleteMany({ where }),
    prisma.auditLog.deleteMany({ where }),
    prisma.consent.deleteMany({ where }),
    prisma.membership.deleteMany({ where }),
    prisma.site.deleteMany({ where: { orgId: { in: DEMO_ORG_IDS } } }),
    prisma.organisation.deleteMany({ where: { id: { in: DEMO_ORG_IDS } } }),
  ]);
  await storage.remove([
    ...steps.flatMap((s) => (s.proofFileKey ? [s.proofFileKey] : [])),
    ...mitraReports.map((r) => r.fileKey),
  ]);
}

async function printCounts() {
  const tables = [
    ['sites', prisma.site],
    ['memberships', prisma.membership],
    ['consents', prisma.consent],
    ['energy_months', prisma.energyMonth],
    ['fuel_entries', prisma.fuelEntry],
    ['production_months', prisma.productionMonth],
    ['results', prisma.result],
    ['baselines', prisma.baseline],
    ['site_actions', prisma.siteAction],
    ['savings_ledger', prisma.savingsLedger],
  ] as const;
  for (const [label, orgId] of [
    ['Demo A', ORG_A],
    ['Demo B', ORG_B],
    ['Demo H', ORG_H],
  ] as const) {
    const parts: string[] = [];
    for (const [name, t] of tables) {
      const n = await (t as unknown as { count(a: unknown): Promise<number> }).count({
        where: { orgId },
      });
      parts.push(`${name}=${n}`);
    }
    console.log(`${label}: ${parts.join(' ')}`);
  }
}

async function main() {
  if (process.argv.includes('--reset')) await resetDemo();
  await seedDemo();
  await printCounts();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().finally(async () => {
    await pdfRenderer.close();
    await prisma.$disconnect();
  });
}
