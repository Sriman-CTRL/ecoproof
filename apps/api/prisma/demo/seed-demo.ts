// SYNTHETIC DEMO DATA - not a real unit or bill. Every non-doc number lives in assumptions.json.
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  fitBaseline,
  footprint,
  monthlySavings,
  savingsStatus,
  type Baseline,
  type Factor,
} from '@ecoproof/calc';
import { DEMO_ORG_IDS, ORG_A, ORG_B, SITE_A, SITE_B, USER_A, USER_B } from '../../src/demo/ids.js';

// ---- fixed demo identifiers (the only rows --reset may delete are those with these org ids)
export { ORG_A, ORG_B, DEMO_ORG_IDS };

const prisma = new PrismaClient();

const A = JSON.parse(
  readFileSync(new URL('./assumptions.json', import.meta.url), 'utf8'),
) as Record<string, number | string>;
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
const monthStart = (i: number) => new Date(Date.UTC(2025, 9 + i, 1)); // i=0 -> Oct 2025
const monthEnd = (i: number) => new Date(Date.UTC(2025, 10 + i, 0));

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

const asFactor = (f: {
  id: string;
  value: Prisma.Decimal;
  unit: string;
  status: Factor['status'];
  gasBasis: Factor['gasBasis'];
}): Factor => ({
  id: f.id,
  value: Number(f.value),
  unit: f.unit,
  status: f.status,
  gasBasis: f.gasBasis,
});

async function seedOrg(opts: {
  orgId: string;
  siteId: string;
  userId: string;
  name: string;
  phone: string;
  rows: MonthRow[];
  withAfter: boolean;
  grid: Factor;
  diesel: Factor;
}) {
  const { orgId, siteId, userId, name, phone, rows, grid, diesel } = opts;
  const tag = orgId === ORG_A ? 'A' : 'B';
  const k = (s: string) => det(`${tag}:${s}`);
  const cd = num('contractedDemandKva');
  const md = num('mdKva');
  const billedMd = Math.max(md, 0.8 * cd);

  await prisma.organisation.upsert({
    where: { id: orgId },
    update: { name },
    create: {
      id: orgId,
      type: 'msme',
      name,
      udyamNo: 'UDYAM-SAMPLE-0001',
      gstin: null,
      sector: 'foundry',
      state: 'Telangana',
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
    const start = monthStart(m.i);
    const energyCharges = r2(m.kvah * rate);
    const demandCharges = r2(billedMd * num('demandRatePerKva'));
    const emId = k(`em:${m.i}`);
    const emData = {
      orgId,
      siteId,
      periodEnd: monthEnd(m.i),
      kwh: m.kwh,
      kvah: m.kvah,
      pf: m.pf,
      mdKva: md,
      peakKwh: r2((m.kwh * num('peakSharePct')) / 100),
      solarHoursKwh: null,
      energyCharges,
      demandCharges,
      otherChargesJson: { low_pf_surcharge: 0, _label: 'SYNTHETIC' },
      qualityTag: 'measured' as const,
    };
    await prisma.energyMonth.upsert({
      where: { id: emId },
      update: emData,
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
      update: prodData,
      create: { id: prodId, month: start, ...prodData },
    });

    const fp = footprint({
      gridKwh: m.kwh,
      fuels: [{ quantity: num('dieselLitresPerMonth'), factor: diesel }],
      outputTonnes: m.p,
      gridFactor: grid,
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
    const { id, month, ...rest } = r;
    await prisma.result.upsert({ where: { id: id! }, update: rest, create: r });
    void month;
  }
  void FORMULA_NOTE;
}

export async function seedDemo() {
  const gridRow = await prisma.factor.findFirst({
    where: { sourceType: 'grid_electricity_india' },
  });
  const dieselRow = await prisma.factor.findFirst({ where: { sourceType: 'diesel_litre' } });
  if (!gridRow || !dieselRow) throw new Error('Reference factors missing: run db:seed first');
  const grid = asFactor(gridRow);
  const diesel = asFactor(dieselRow);

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
    grid,
    diesel,
  });
  const rowsB = monthRows(true, baseline);
  await seedOrg({
    orgId: ORG_B,
    siteId: SITE_B,
    userId: USER_B,
    phone: '+91-SAMPLE-0002',
    name: 'Sri Lakshmi Castings (sample, 6 months later)',
    rows: rowsB,
    withAfter: true,
    grid,
    diesel,
  });

  // ---- Demo B: baseline, actions, savings ledger
  const kb = (s: string) => det(`B:${s}`);
  const baseData = {
    orgId: ORG_B,
    siteId: SITE_B,
    start: monthStart(0),
    end: monthEnd(11),
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
  if (!pfAction) throw new Error('action fix_power_factor missing: run db:seed first');
  const effData = {
    sector: 'foundry',
    equipment: 'Efficiency measure (placeholder until research R2)',
    isZeroCost: false,
    enduse: 'electricity' as const,
    status: 'placeholder',
    source: 'SYNTHETIC DEMO placeholder until research R2; no savings or cost range stated',
  };
  const effAction = await prisma.actionLibrary.upsert({
    where: { code: 'efficiency_measure_pending_r2' },
    update: effData,
    create: { code: 'efficiency_measure_pending_r2', ...effData },
  });
  const doneAt = new Date('2026-09-30T00:00:00Z');
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

  // Ledger: the kWh saving is credited to the efficiency measure (PF fix saves kVAh, not kWh).
  let cumulative = 0;
  for (const m of rowsB.filter((r) => r.i >= 12)) {
    const energyCharges = m.kvah * num('energyRatePerKvah');
    const s = monthlySavings({
      baseline,
      productionTonnes: m.p,
      actualKwh: m.kwh,
      effectiveRatePerKwh: energyCharges / m.kwh,
      gridFactor: grid,
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
      month: monthStart(m.i),
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
}

export async function resetDemo() {
  const where = { orgId: { in: DEMO_ORG_IDS } };
  await prisma.$transaction([
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
    prisma.share.deleteMany({ where }),
    prisma.report.deleteMany({ where }),
    prisma.auditLog.deleteMany({ where }),
    prisma.consent.deleteMany({ where }),
    prisma.membership.deleteMany({ where }),
    prisma.site.deleteMany({ where: { orgId: { in: DEMO_ORG_IDS } } }),
    prisma.organisation.deleteMany({ where: { id: { in: DEMO_ORG_IDS } } }),
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
  main().finally(() => prisma.$disconnect());
}
