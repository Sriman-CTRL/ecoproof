import {
  CII_INDUCTION_KWH_PER_TONNE,
  daysInPeriod,
  kwhPerTonneBand,
  KWH_PER_TONNE_BAND,
  loadFactor,
  RECOMPUTE_TOLERANCE_PCT,
  recomputeBill,
  type BillCheck,
  pdfFlags,
  type PdfFlag,
  type PdfMeta,
} from '@ecoproof/calc';
import type { PowerBillFields } from '@ecoproof/shared';
import type { Document, EnergyMonth, Site, TariffRule } from '@prisma/client';
import { prisma } from '../db.js';
import { loadSiteRules, rulesForPeriod } from './insights.js';

/** D89: how a month came in. Strength order: DISCOM PDF > photo > typed (findings-data-intake E). */
export type SourceKind = 'discom_pdf' | 'photo' | 'typed' | 'sample';

export const SOURCE_TEXT: Record<SourceKind, string> = {
  discom_pdf: 'From DISCOM PDF',
  photo: 'Read from photo',
  typed: 'Typed by owner',
  sample: 'Sample bill (demo)',
};

export const STRENGTH_TEXT = {
  pdf_passed: 'From DISCOM PDF, checks passed',
  photo_confirmed: 'Read from photo, owner confirmed',
  typed: 'Typed by owner',
  second_look: 'Needs a second look',
} as const;
export type Strength = keyof typeof STRENGTH_TEXT;

export const METHOD_NOTE = `Bill recompute uses the TGERC FY 2026-27 HT-I(A) rates in our tariff table; other charges are taken as printed. A difference above ${RECOMPUTE_TOLERANCE_PCT}% is our choice of tolerance. The kWh-per-tonne band (${CII_INDUCTION_KWH_PER_TONNE * KWH_PER_TONNE_BAND.lowShare}-${CII_INDUCTION_KWH_PER_TONNE * KWH_PER_TONNE_BAND.highShare}) is our choice around the CII induction-melting norm of ${CII_INDUCTION_KWH_PER_TONNE} kWh/t.`;

export interface BillInput {
  periodStart: string;
  periodEnd: string;
  kwh: number;
  kvah: number;
  mdKva: number;
  contractedDemandKva: number | null;
  energyCharges: number | null;
  demandCharges: number | null;
  otherInr: number;
  total: number | null;
  consumerNo: string | null;
}

export interface FileInfo {
  sourceKind: SourceKind | null;
  /** A4 result stored at upload: null when the file was not a PDF. */
  fileCheck: { flags: PdfFlag[]; isPdf: boolean; meta?: PdfMeta | null } | null;
}

const inr = (n: number) => `Rs ${new Intl.NumberFormat('en-IN').format(Math.round(n))}`;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const num = (d: { toString(): string } | null | undefined) => (d == null ? null : Number(d));
const param = (r: TariffRule | undefined, key: string): number | null => {
  const v = (r?.paramsJson as Record<string, unknown> | undefined)?.[key];
  return typeof v === 'number' ? v : null;
};

export const fromFields = (f: PowerBillFields): BillInput => ({
  periodStart: f.periodStart,
  periodEnd: f.periodEnd,
  kwh: f.kwh,
  kvah: f.kvah,
  mdKva: f.mdKva,
  contractedDemandKva: f.contractedDemandKva,
  energyCharges: f.energyCharges,
  demandCharges: f.demandCharges,
  otherInr: Object.values(f.otherCharges).reduce((t, v) => t + v, 0),
  total: f.total,
  consumerNo: f.consumerNo,
});

export function fromMonth(m: EnergyMonth, site: Site, consumerNo: string | null): BillInput {
  const other = Object.entries((m.otherChargesJson ?? {}) as Record<string, unknown>)
    .filter(([k, v]) => !k.startsWith('_') && typeof v === 'number')
    .reduce((t, [, v]) => t + (v as number), 0);
  return {
    periodStart: iso(m.periodStart),
    periodEnd: iso(m.periodEnd),
    kwh: num(m.kwh) ?? 0,
    kvah: num(m.kvah) ?? 0,
    mdKva: num(m.mdKva) ?? 0,
    contractedDemandKva: num(site.contractedDemandKva),
    energyCharges: num(m.energyCharges),
    demandCharges: num(m.demandCharges),
    otherInr: other,
    total: null,
    consumerNo,
  };
}

/** All checks for one bill. `months` = the site's other months (for B2), `tonnes` from step 4. */
export function billChecks(o: {
  bill: BillInput;
  rules: Map<string, TariffRule>;
  siteConsumerNo: string | null;
  tonnes: number | null;
  file: FileInfo;
  duplicate: boolean;
  gaps: string[];
  overlaps: boolean;
}): BillCheck[] {
  const { bill: b, rules } = o;
  const out: BillCheck[] = [];

  // A1 recompute from tariff_rules.
  const energyRate = param(rules.get('energy_charge'), 'rate_inr_per_kvah');
  const demandRate = param(rules.get('demand_charge'), 'rate_inr_per_kva_month');
  if (
    energyRate == null ||
    demandRate == null ||
    b.contractedDemandKva == null ||
    b.energyCharges == null ||
    b.demandCharges == null
  ) {
    out.push({
      code: 'A1',
      result: 'cant_check',
      line: "Can't recompute: the tariff rates or the bill's charge lines are missing.",
    });
  } else {
    const r = recomputeBill({
      kvah: b.kvah,
      mdKva: b.mdKva,
      contractedDemandKva: b.contractedDemandKva,
      energyRateInrPerKvah: energyRate,
      demandRateInrPerKva: demandRate,
      minKvahPerKvaBillingDemand: param(
        rules.get('minimum_charge'),
        'kvah_per_kva_billing_demand_per_month',
      ),
      billingDemandFloorShare: 0.8,
      printed: {
        energy: b.energyCharges,
        demand: b.demandCharges,
        other: b.otherInr,
        total: b.total,
      },
    });
    out.push({
      code: 'A1',
      result: r.pass ? 'pass' : 'flag',
      line: r.pass
        ? `Recomputed from the tariff: energy ${inr(r.expected.energy)}, demand ${inr(r.expected.demand)} (billing demand ${r.billingDemandKva} kVA). Matches the bill.`
        : `The bill's numbers don't add up: from ${new Intl.NumberFormat('en-IN').format(b.kvah)} kVAh the energy charge should be ${inr(r.expected.energy)}, the bill says ${inr(b.energyCharges)}.`,
    });
  }

  // A2 physics.
  const pf = b.kvah > 0 ? b.kwh / b.kvah : 0;
  const a2 = b.kwh <= b.kvah && pf >= 0.5 && pf <= 1;
  out.push({
    code: 'A2',
    result: a2 ? 'pass' : 'flag',
    line: a2
      ? `kWh is not above kVAh; power factor ${pf.toFixed(2)} is between 0.5 and 1.0.`
      : `kWh and kVAh do not fit together (power factor ${pf.toFixed(2)}).`,
  });

  // A3 load factor.
  if (b.mdKva > 0) {
    const days = daysInPeriod(b.periodStart, b.periodEnd);
    const lf = loadFactor({ kvah: b.kvah, mdKva: b.mdKva, days });
    out.push({
      code: 'A3',
      result: lf.pass ? 'pass' : 'flag',
      line: lf.pass
        ? `Energy fits the peak demand: ${Math.round(lf.ratio * 100)}% of the most a ${b.mdKva} kVA peak allows in ${days} days.`
        : `More energy than a ${b.mdKva} kVA peak allows in ${days} days. Needs a second look.`,
    });
  } else {
    out.push({
      code: 'A3',
      result: 'cant_check',
      line: "Can't check: no maximum demand on the bill.",
    });
  }

  // A4 PDF file check.
  const fc = o.file.fileCheck;
  if (!fc || !fc.isPdf) {
    out.push({
      code: 'A4',
      result: 'cant_check',
      line:
        o.file.sourceKind === 'typed'
          ? "Can't check: typed by the owner, no file."
          : "Can't check: not a PDF file.",
    });
  } else {
    // Dates are judged against this bill's period, known only after reading.
    const flags = fc.meta ? pdfFlags(fc.meta, { periodStart: b.periodStart }) : fc.flags;
    out.push({
      code: 'A4',
      result: flags.length ? 'flag' : 'pass',
      line: flags.length
        ? `Needs a second look: ${flags.map((f) => f.line).join(' ')}`
        : 'PDF file looks as made: no editing software named, dates fit, text inside.',
    });
  }

  // A5 same file twice.
  out.push({
    code: 'A5',
    result: o.duplicate ? 'flag' : 'pass',
    line: o.duplicate
      ? 'This exact file was uploaded before; it is not counted twice.'
      : 'First time this file is seen (SHA-256 of the file).',
  });

  // B1 consumer number.
  if (!o.siteConsumerNo || !b.consumerNo) {
    out.push({
      code: 'B1',
      result: 'cant_check',
      line: "Can't check: no consumer number to compare.",
    });
  } else {
    const same = b.consumerNo.trim() === o.siteConsumerNo.trim();
    out.push({
      code: 'B1',
      result: same ? 'pass' : 'flag',
      line: same
        ? `Consumer number ${b.consumerNo} is your business's number.`
        : `Consumer number ${b.consumerNo} is not your business's number (${o.siteConsumerNo}).`,
    });
  }

  // B2 gaps / overlaps.
  out.push({
    code: 'B2',
    result: o.overlaps || o.gaps.length ? 'flag' : 'pass',
    line: o.overlaps
      ? 'This bill period overlaps a month already on file.'
      : o.gaps.length
        ? `Missing months shown as gaps (never filled in): ${o.gaps.join(', ')}.`
        : 'No gaps or overlaps in the last 12 months.',
  });

  // C1 kWh per tonne.
  if (o.tonnes == null || o.tonnes <= 0) {
    out.push({
      code: 'C1',
      result: 'cant_check',
      line: "Can't check yet: add this month's tonnes of good castings (step 4).",
    });
  } else {
    const c = kwhPerTonneBand({ kwh: b.kwh, tonnes: o.tonnes });
    const v = Math.round(c.value ?? 0);
    out.push({
      code: 'C1',
      result: c.inBand ? 'pass' : 'flag',
      line: c.inBand
        ? `${v} kWh per tonne, inside the usual range (${c.low}-${c.high}; CII norm ${c.norm}).`
        : `${v} kWh per tonne is unusual, please check (usual range ${c.low}-${c.high}; CII norm ${c.norm}).`,
    });
  }
  return out;
}

const monthKey = (d: string) => d.slice(0, 7);
const monthName = (ym: string) =>
  new Date(`${ym}-01T00:00:00Z`).toLocaleString('en-IN', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

/** B2: the 12 months up to `upTo`, which exist, which are gaps, and whether `bill` overlaps one. */
export function yearStrip(
  months: Array<{ periodStart: string; periodEnd: string; id?: string }>,
  upTo: string,
  bill?: { periodStart: string; periodEnd: string; excludeId?: string },
) {
  const have = new Set(months.map((m) => monthKey(m.periodStart)));
  const end = new Date(`${upTo.slice(0, 7)}-01T00:00:00Z`);
  const strip: Array<{ month: string; label: string; present: boolean }> = [];
  for (let k = 11; k >= 0; k--) {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - k, 1));
    const ym = d.toISOString().slice(0, 7);
    strip.push({
      month: `${ym}-01`,
      label: monthName(ym),
      present: have.has(ym) || (bill != null && monthKey(bill.periodStart) === ym),
    });
  }
  const firstPresent = strip.findIndex((s) => s.present);
  const gaps =
    firstPresent < 0
      ? []
      : strip
          .slice(firstPresent)
          .filter((s) => !s.present)
          .map((s) => s.label);
  const overlaps =
    bill != null &&
    months.some(
      (m) =>
        m.id !== bill.excludeId &&
        m.periodStart <= bill.periodEnd &&
        bill.periodStart <= m.periodEnd,
    );
  return { strip, gaps, overlaps };
}

export function strengthOf(sourceKind: string | null, checks: BillCheck[]): Strength {
  if (checks.some((c) => c.result === 'flag')) return 'second_look';
  if (sourceKind === 'discom_pdf' || sourceKind === 'sample') return 'pdf_passed';
  if (sourceKind === 'photo') return 'photo_confirmed';
  return 'typed';
}

/** Everything billChecks needs from the DB for one site, loaded once. */
export async function checkContext(site: Site) {
  const [rows, months, production] = await Promise.all([
    loadSiteRules(site),
    prisma.energyMonth.findMany({
      where: { orgId: site.orgId, siteId: site.id },
      orderBy: { periodStart: 'asc' },
    }),
    prisma.productionMonth.findMany({ where: { orgId: site.orgId, siteId: site.id } }),
  ]);
  const tonnesByMonth = new Map(production.map((p) => [iso(p.month), Number(p.quantity)]));
  const docIds = months.map((m) => m.documentId).filter((x): x is string => x != null);
  const docs: Document[] = docIds.length
    ? await prisma.document.findMany({ where: { orgId: site.orgId, id: { in: docIds } } })
    : [];
  return {
    rulesAt: (periodEnd: string) => rulesForPeriod(rows, new Date(`${periodEnd}T00:00:00Z`)),
    months,
    spans: months.map((m) => ({
      id: m.id,
      periodStart: iso(m.periodStart),
      periodEnd: iso(m.periodEnd),
    })),
    tonnesByMonth,
    docsById: new Map(docs.map((d) => [d.id, d])),
  };
}

export const fileInfo = (
  d: Pick<Document, 'sourceKind' | 'fileCheckJson'> | null | undefined,
): FileInfo => ({
  sourceKind: (d?.sourceKind as SourceKind | null) ?? null,
  fileCheck: (d?.fileCheckJson as FileInfo['fileCheck']) ?? null,
});
