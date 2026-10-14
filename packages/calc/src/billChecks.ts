/**
 * D89 bill checks (findings-data-intake.md section 4). Pure: the caller passes the bill, the tariff
 * rates from tariff_rules and the PDF bytes; nothing here reads a database or a file.
 */

export type CheckResult = 'pass' | 'flag' | 'cant_check';

export interface BillCheck {
  code: 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'B1' | 'B2' | 'C1';
  result: CheckResult;
  /** One plain line for the owner. */
  line: string;
}

/** OUR CHOICE (findings-data-intake A1): recomputed charges may differ from the bill by 1%. */
export const RECOMPUTE_TOLERANCE_PCT = 1;

export interface RecomputeInput {
  kvah: number;
  mdKva: number;
  contractedDemandKva: number;
  /** tariff_rules energy_charge.rate_inr_per_kvah */
  energyRateInrPerKvah: number;
  /** tariff_rules demand_charge.rate_inr_per_kva_month */
  demandRateInrPerKva: number;
  /** tariff_rules minimum_charge.kvah_per_kva_billing_demand_per_month (null: not applied) */
  minKvahPerKvaBillingDemand: number | null;
  /** Share of contracted demand that sets the floor of billing demand (billing_demand rule: 0.8). */
  billingDemandFloorShare: number;
  printed: { energy: number; demand: number; other: number; total: number | null };
}

export interface RecomputeResult {
  billingDemandKva: number;
  expected: { energy: number; demand: number; total: number };
  /** Percent difference, printed vs expected, per line. */
  diffPct: { energy: number; demand: number; total: number | null };
  pass: boolean;
}

const pctDiff = (printed: number, expected: number) =>
  expected === 0 ? (printed === 0 ? 0 : 100) : (Math.abs(printed - expected) / expected) * 100;
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * A1: energy = billed kVAh x energy rate (billed kVAh is the higher of actual kVAh or the minimum
 * kVAh per kVA of billing demand); demand = billing demand x demand rate, where billing demand is
 * the higher of recorded MD or the floor share of contracted demand. Other charges as printed.
 */
export function recomputeBill(i: RecomputeInput, tolerancePct = RECOMPUTE_TOLERANCE_PCT) {
  const billingDemandKva = Math.max(i.mdKva, i.billingDemandFloorShare * i.contractedDemandKva);
  const billedKvah =
    i.minKvahPerKvaBillingDemand == null
      ? i.kvah
      : Math.max(i.kvah, i.minKvahPerKvaBillingDemand * billingDemandKva);
  const energy = r2(billedKvah * i.energyRateInrPerKvah);
  const demand = r2(billingDemandKva * i.demandRateInrPerKva);
  const total = r2(energy + demand + i.printed.other);
  const diffPct = {
    energy: pctDiff(i.printed.energy, energy),
    demand: pctDiff(i.printed.demand, demand),
    total: i.printed.total == null ? null : pctDiff(i.printed.total, total),
  };
  const pass =
    diffPct.energy <= tolerancePct &&
    diffPct.demand <= tolerancePct &&
    (diffPct.total == null || diffPct.total <= tolerancePct);
  return {
    billingDemandKva,
    expected: { energy, demand, total },
    diffPct,
    pass,
  } satisfies RecomputeResult;
}

/** Days in a bill period, both ends included. */
export function daysInPeriod(periodStart: string, periodEnd: string): number {
  const a = Date.parse(`${periodStart}T00:00:00Z`);
  const b = Date.parse(`${periodEnd}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000) + 1;
}

/**
 * A3: a unit cannot draw more energy than its peak demand allows over the period:
 * kVAh <= MD x 24 x days. The inequality is our arithmetic (findings-data-intake A3).
 */
export function loadFactor(i: { kvah: number; mdKva: number; days: number }) {
  const ceiling = i.mdKva * 24 * i.days;
  const ratio = ceiling > 0 ? i.kvah / ceiling : Number.POSITIVE_INFINITY;
  return { ceilingKvah: ceiling, ratio, pass: ratio <= 1 };
}

/** CII norm for induction melting, "620 kWh/ton" (findings-data-intake C1, Arasu & Jeffrey 2009). */
export const CII_INDUCTION_KWH_PER_TONNE = 620;
/**
 * OUR CHOICE (findings-data-intake C1): per tonne of good castings is higher than per tonne of
 * liquid metal, so the band is wide, half to twice the norm. Outside it: "unusual, please check".
 */
export const KWH_PER_TONNE_BAND = { lowShare: 0.5, highShare: 2 } as const;

export function kwhPerTonneBand(i: { kwh: number; tonnes: number }) {
  const low = CII_INDUCTION_KWH_PER_TONNE * KWH_PER_TONNE_BAND.lowShare;
  const high = CII_INDUCTION_KWH_PER_TONNE * KWH_PER_TONNE_BAND.highShare;
  const value = i.tonnes > 0 ? i.kwh / i.tonnes : null;
  return {
    value,
    low,
    high,
    norm: CII_INDUCTION_KWH_PER_TONNE,
    inBand: value != null && value >= low && value <= high,
  };
}

// ------------------------------------------------------------------ A4: PDF file check

export interface PdfMeta {
  producer: string | null;
  creator: string | null;
  /** ISO date (YYYY-MM-DD) from /CreationDate, or null. */
  creationDate: string | null;
  fontCount: number;
  imageCount: number;
  pageCount: number;
}

const latin1 = (b: Uint8Array) => {
  let s = '';
  for (let i = 0; i < b.length; i += 8192) {
    s += String.fromCharCode(...b.subarray(i, i + 8192));
  }
  return s;
};

const pdfString = (src: string, key: string): string | null => {
  const m = new RegExp(`/${key}\\s*\\(((?:\\\\.|[^\\\\)])*)\\)`).exec(src);
  return m ? m[1]!.replace(/\\(.)/g, '$1').trim() : null;
};

/**
 * Reads the info dictionary and counts fonts, images and pages from the raw bytes. Only what is
 * stored uncompressed is seen; anything else comes back null or 0 and the check says so.
 */
export function readPdfMeta(bytes: Uint8Array): PdfMeta | null {
  const src = latin1(bytes);
  if (!src.startsWith('%PDF-')) return null;
  const xmpTool = /<xmp:CreatorTool>([^<]*)<\/xmp:CreatorTool>/.exec(src)?.[1] ?? null;
  const date = /\/CreationDate\s*\(D:(\d{4})(\d{2})(\d{2})/.exec(src);
  return {
    producer: pdfString(src, 'Producer'),
    creator: pdfString(src, 'Creator') ?? xmpTool,
    creationDate: date ? `${date[1]}-${date[2]}-${date[3]}` : null,
    fontCount: (src.match(/\/Type\s*\/Font\b/g) ?? []).length,
    imageCount: (src.match(/\/Subtype\s*\/Image\b/g) ?? []).length,
    pageCount: (src.match(/\/Type\s*\/Page\b(?!s)/g) ?? []).length,
  };
}

/** Editing software named in Producer/Creator (findings-data-intake A4: "Creator field shows editing software"). */
const EDITOR_PATTERN =
  /\b(word|photoshop|illustrator|gimp|canva|ilovepdf|smallpdf|sejda|pdfescape|pdf-?xchange|foxit phantom|acrobat pro|libreoffice|openoffice|inkscape|paint)\b/i;

export interface PdfFlag {
  code: 'editor' | 'made_before_period' | 'flat_image';
  line: string;
}

/**
 * A4 flags (a flag, not a block). "Made before the period" compares the file's creation date with
 * the start of the bill period: a bill file cannot exist before its period begins.
 */
export function pdfFlags(meta: PdfMeta, bill: { periodStart: string }): PdfFlag[] {
  const flags: PdfFlag[] = [];
  const tool = [meta.producer, meta.creator].filter(Boolean).join(' / ');
  if (tool && EDITOR_PATTERN.test(tool)) {
    flags.push({ code: 'editor', line: `The file was last saved by editing software (${tool}).` });
  }
  if (meta.creationDate && meta.creationDate < bill.periodStart) {
    flags.push({
      code: 'made_before_period',
      line: `The file is dated ${meta.creationDate}, before the bill period began (${bill.periodStart}).`,
    });
  }
  if (meta.fontCount === 0 && meta.imageCount >= 1 && meta.pageCount <= 1) {
    flags.push({
      code: 'flat_image',
      line: 'The PDF is one flat picture with no text, not a PDF made by the DISCOM.',
    });
  }
  return flags;
}
