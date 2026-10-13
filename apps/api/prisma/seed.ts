import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

function load<T extends z.ZodType>(file: string, schema: T): z.infer<T> {
  const raw = JSON.parse(readFileSync(new URL(`./seed-data/${file}`, import.meta.url), 'utf8'));
  return schema.parse(raw);
}

const date = z
  .string()
  .nullable()
  .transform((v) => (v ? new Date(`${v}T00:00:00Z`) : null));

const FactorRow = z.object({
  source_type: z.string(),
  value: z.number(),
  unit: z.string(),
  source: z.string(),
  source_url: z.string().nullable(),
  status: z.enum(['confirmed', 'confirmed_replace', 'verify', 'estimate_only', 'rule']),
  gas_basis: z.enum(['CO2', 'CO2e']).nullable(),
  valid_from: date,
  valid_to: date,
  version: z.string().nullable(),
  basis_note: z.string().nullable(),
  page: z.string().nullable(),
  quoted_line: z.string().nullable(),
  /** Natural key of the row that replaces this one. */
  superseded_by: z
    .object({ source_type: z.string(), version: z.string().nullable(), valid_from: date })
    .nullable(),
});

const TariffRow = z.object({
  discom: z.string(),
  category: z.string(),
  rule_type: z.string(),
  params: z.record(z.string(), z.unknown()),
  source: z.string(),
  valid_from: date,
  basis_note: z.string().nullable(),
  status: z.string().nullable(),
  version: z.string(),
  source_url: z.string().nullable(),
  page: z.string().nullable(),
  quoted_line: z.string().nullable(),
});

const SchemeRow = z.object({
  code: z.string().nullable(),
  name: z.string(),
  sort_order: z.number().int(),
  benefit_text: z.string().nullable(),
  rules: z.record(z.string(), z.unknown()),
  rate_range: z.string().nullable(),
  source: z.string(),
  source_url: z.string().nullable(),
  quoted_line: z.string().nullable(),
  active: z.boolean(),
  status_note: z.string().nullable(),
  last_checked_at: date,
});

const CbamCnRow = z.object({
  code: z.string(),
  description: z.string(),
  in_scope_now: z.boolean(),
  proposed_from: date,
  india_default_total: z.number().nullable(),
  source: z.string(),
  source_url: z.string().nullable(),
});

const CbamMarkupRow = z.object({
  year_from: z.number().int(),
  pct: z.number(),
  source: z.string(),
  source_url: z.string().nullable(),
  quoted_line: z.string().nullable(),
});

const BenchmarkRow = z.object({
  sector: z.string(),
  metric: z.string(),
  low: z.number(),
  high: z.number(),
  unit: z.string(),
  source: z.string(),
  status: z.string(),
});

const ActionRow = z.object({
  code: z.string(),
  sector: z.string(),
  equipment: z.string(),
  is_zero_cost: z.boolean(),
  enduse: z.enum(['electricity', 'fuel']),
  status: z.string(),
  source: z.string(),
  cost_low: z.number().nullable(),
  cost_high: z.number().nullable(),
  source_url: z.string().nullable(),
  page: z.string().nullable(),
  quoted_line: z.string().nullable(),
  cost_year: z.string().nullable(),
  cost_note: z.string().nullable(),
  saving_low: z.number().nullable(),
  saving_high: z.number().nullable(),
  enduse_share_low: z.number().min(0).max(1).nullable(),
  enduse_share_high: z.number().min(0).max(1).nullable(),
  enduse_share_note: z.string().nullable(),
  saving_note: z.string().nullable(),
});

const json = (v: unknown) => v as Prisma.InputJsonValue;

const factorKey = (f: {
  source_type: string;
  version: string | null;
  valid_from: Date | null;
}) => ({
  sourceType: f.source_type,
  version: f.version,
  validFrom: f.valid_from,
});

// D7 Mitra (findings-round2.md "Free help listed in Mitra" and "Re-check, 13 Oct").
const MitraItemRow = z.object({
  code: z.string(),
  page: z.enum(['ngo', 'govt', 'both']),
  kind: z.enum(['handoff', 'link', 'commitment', 'visit', 'learn']),
  sort_order: z.number().int(),
  title: z.string(),
  run_by: z.string(),
  free_help: z.string(),
  business_gain: z.string(),
  carbon_line: z.string().nullable(),
  how_to_start: z.string(),
  url: z.string().nullable(),
  contact_email: z.string().nullable(),
  contact_phone: z.string().nullable(),
  address: z.string().nullable(),
  source_url: z.string(),
  quoted_line: z.string(),
  dates_unconfirmed: z.boolean(),
});

const PeerCaseRow = z.object({
  code: z.string(),
  sort_order: z.number().int(),
  company: z.string(),
  place: z.string(),
  action_code: z.string().nullable(),
  measure: z.string(),
  investment_text: z.string(),
  saving_text: z.string().nullable(),
  payback_text: z.string(),
  before_after_text: z.string().nullable(),
  source: z.string(),
  source_url: z.string(),
  page: z.string().nullable(),
  quoted_line: z.string(),
});

/** Every Mitra row was last checked on 13 Oct 2026 (findings-round2.md re-check). */
const MITRA_LAST_CHECKED = new Date('2026-10-13T00:00:00Z');

// Reference rows are never deleted: results store factor IDs, so IDs must stay stable.
async function main() {
  const factors = load('factors.json', z.array(FactorRow));
  const tariffs = load('tariff_rules.json', z.array(TariffRow));
  const schemes = load('schemes.json', z.array(SchemeRow));
  const benchmarks = load('benchmarks.json', z.array(BenchmarkRow));
  const actions = load('action_library.json', z.object({ rows: z.array(ActionRow) })).rows;
  const cnCodes = load('cbam_cn_codes.json', z.array(CbamCnRow));
  const markups = load('cbam_markups.json', z.array(CbamMarkupRow));
  const mitraItems = load('mitra_items.json', z.array(MitraItemRow));
  const peerCases = load('peer_cases.json', z.array(PeerCaseRow));

  await prisma.$transaction(async (tx) => {
    for (const f of factors) {
      const data = {
        sourceType: f.source_type,
        value: f.value,
        unit: f.unit,
        source: f.source,
        sourceUrl: f.source_url,
        status: f.status,
        gasBasis: f.gas_basis,
        validFrom: f.valid_from,
        validTo: f.valid_to,
        version: f.version,
        basisNote: f.basis_note,
        page: f.page,
        quotedLine: f.quoted_line,
      };
      // Natural key (source_type, version, valid_from): both are nullable, so no compound upsert.
      const existing = await tx.factor.findFirst({ where: factorKey(f) });
      if (existing) await tx.factor.update({ where: { id: existing.id }, data });
      else await tx.factor.create({ data });
    }
    // Second pass: superseded_by points at another row's id, which may only now exist.
    for (const f of factors) {
      const next = f.superseded_by
        ? await tx.factor.findFirst({ where: factorKey(f.superseded_by) })
        : null;
      if (f.superseded_by && !next)
        throw new Error(`superseded_by row missing for ${f.source_type}`);
      await tx.factor.updateMany({ where: factorKey(f), data: { supersededBy: next?.id ?? null } });
    }

    for (const t of tariffs) {
      const data = {
        paramsJson: json(t.params),
        validFrom: t.valid_from,
        source: t.source,
        basisNote: t.basis_note,
        status: t.status,
        sourceUrl: t.source_url,
        page: t.page,
        quotedLine: t.quoted_line,
      };
      const key = {
        discom: t.discom,
        category: t.category,
        ruleType: t.rule_type,
        version: t.version,
      };
      await tx.tariffRule.upsert({
        where: { discom_category_ruleType_version: key },
        update: data,
        create: { ...key, ...data },
      });
    }

    for (const s of schemes) {
      const data = {
        name: s.name,
        rulesJson: json(s.rules),
        rateRange: s.rate_range,
        source: s.source,
        sourceUrl: s.source_url,
        quotedLine: s.quoted_line,
        benefitText: s.benefit_text,
        sortOrder: s.sort_order,
        active: s.active,
        statusNote: s.status_note,
        lastCheckedAt: s.last_checked_at,
      };
      // Sourced rows are keyed by code; legacy rows (no code) by name.
      if (s.code) {
        await tx.scheme.upsert({
          where: { code: s.code },
          update: data,
          create: { code: s.code, ...data },
        });
      } else {
        await tx.scheme.upsert({ where: { name: s.name }, update: data, create: data });
      }
    }

    for (const c of cnCodes) {
      const data = {
        description: c.description,
        inScopeNow: c.in_scope_now,
        proposedFrom: c.proposed_from,
        indiaDefaultTotal: c.india_default_total,
        source: c.source,
        sourceUrl: c.source_url,
      };
      await tx.cbamCnCode.upsert({
        where: { code: c.code },
        update: data,
        create: { code: c.code, ...data },
      });
    }

    for (const m of markups) {
      const data = {
        pct: m.pct,
        source: m.source,
        sourceUrl: m.source_url,
        quotedLine: m.quoted_line,
      };
      await tx.cbamMarkup.upsert({
        where: { yearFrom: m.year_from },
        update: data,
        create: { yearFrom: m.year_from, ...data },
      });
    }

    for (const b of benchmarks) {
      const data = { low: b.low, high: b.high, unit: b.unit, source: b.source, status: b.status };
      await tx.benchmark.upsert({
        where: { sector_metric: { sector: b.sector, metric: b.metric } },
        update: data,
        create: { sector: b.sector, metric: b.metric, ...data },
      });
    }

    for (const a of actions) {
      const data = {
        sector: a.sector,
        equipment: a.equipment,
        isZeroCost: a.is_zero_cost,
        enduse: a.enduse,
        status: a.status,
        source: a.source,
        costLow: a.cost_low,
        costHigh: a.cost_high,
        sourceUrl: a.source_url,
        page: a.page,
        quotedLine: a.quoted_line,
        costYear: a.cost_year,
        costNote: a.cost_note,
        savingLow: a.saving_low,
        savingHigh: a.saving_high,
        enduseShareLow: a.enduse_share_low,
        enduseShareHigh: a.enduse_share_high,
        enduseShareNote: a.enduse_share_note,
        savingNote: a.saving_note,
      };
      await tx.actionLibrary.upsert({
        where: { code: a.code },
        update: data,
        create: { code: a.code, ...data },
      });
    }
  });

  for (const m of mitraItems) {
    const data = {
      page: m.page,
      kind: m.kind,
      sortOrder: m.sort_order,
      title: m.title,
      runBy: m.run_by,
      freeHelp: m.free_help,
      businessGain: m.business_gain,
      carbonLine: m.carbon_line,
      howToStart: m.how_to_start,
      url: m.url,
      contactEmail: m.contact_email,
      contactPhone: m.contact_phone,
      address: m.address,
      sourceUrl: m.source_url,
      quotedLine: m.quoted_line,
      datesUnconfirmed: m.dates_unconfirmed,
      lastChecked: MITRA_LAST_CHECKED,
    };
    await prisma.mitraItem.upsert({
      where: { code: m.code },
      update: data,
      create: { code: m.code, ...data },
    });
  }
  for (const p of peerCases) {
    const data = {
      sortOrder: p.sort_order,
      company: p.company,
      place: p.place,
      actionCode: p.action_code,
      measure: p.measure,
      investmentText: p.investment_text,
      savingText: p.saving_text,
      paybackText: p.payback_text,
      beforeAfterText: p.before_after_text,
      source: p.source,
      sourceUrl: p.source_url,
      page: p.page,
      quotedLine: p.quoted_line,
    };
    await prisma.peerCase.upsert({
      where: { code: p.code },
      update: data,
      create: { code: p.code, ...data },
    });
  }

  const counts = {
    factors: await prisma.factor.count(),
    tariff_rules: await prisma.tariffRule.count(),
    schemes: await prisma.scheme.count(),
    benchmarks: await prisma.benchmark.count(),
    action_library: await prisma.actionLibrary.count(),
    cbam_cn_codes: await prisma.cbamCnCode.count(),
    cbam_markups: await prisma.cbamMarkup.count(),
    mitra_items: await prisma.mitraItem.count(),
    peer_cases: await prisma.peerCase.count(),
  };
  for (const [table, n] of Object.entries(counts)) console.log(`${table}: ${n}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
