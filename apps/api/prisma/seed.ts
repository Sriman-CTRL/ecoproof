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
  version: z.string().nullable(),
  basis_note: z.string().nullable(),
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
});

const SchemeRow = z.object({
  name: z.string(),
  rules: z.record(z.string(), z.unknown()),
  rate_range: z.string().nullable(),
  source: z.string(),
  active: z.boolean(),
  status_note: z.string().nullable(),
  last_checked_at: date,
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
});

const json = (v: unknown) => v as Prisma.InputJsonValue;

// Reference rows are never deleted: results store factor IDs, so IDs must stay stable.
async function main() {
  const factors = load('factors.json', z.array(FactorRow));
  const tariffs = load('tariff_rules.json', z.array(TariffRow));
  const schemes = load('schemes.json', z.array(SchemeRow));
  const benchmarks = load('benchmarks.json', z.array(BenchmarkRow));
  const actions = load('action_library.json', z.object({ rows: z.array(ActionRow) })).rows;

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
        version: f.version,
        basisNote: f.basis_note,
      };
      // version is nullable, so a compound unique/upsert cannot be used for the key.
      const existing = await tx.factor.findFirst({
        where: { sourceType: f.source_type, version: f.version },
      });
      if (existing) await tx.factor.update({ where: { id: existing.id }, data });
      else await tx.factor.create({ data });
    }

    for (const t of tariffs) {
      const data = {
        paramsJson: json(t.params),
        validFrom: t.valid_from,
        source: t.source,
        basisNote: t.basis_note,
        status: t.status,
      };
      await tx.tariffRule.upsert({
        where: {
          discom_category_ruleType: {
            discom: t.discom,
            category: t.category,
            ruleType: t.rule_type,
          },
        },
        update: data,
        create: { discom: t.discom, category: t.category, ruleType: t.rule_type, ...data },
      });
    }

    for (const s of schemes) {
      const data = {
        rulesJson: json(s.rules),
        rateRange: s.rate_range,
        source: s.source,
        active: s.active,
        statusNote: s.status_note,
        lastCheckedAt: s.last_checked_at,
      };
      await tx.scheme.upsert({
        where: { name: s.name },
        update: data,
        create: { name: s.name, ...data },
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
      };
      await tx.actionLibrary.upsert({
        where: { code: a.code },
        update: data,
        create: { code: a.code, ...data },
      });
    }
  });

  const counts = {
    factors: await prisma.factor.count(),
    tariff_rules: await prisma.tariffRule.count(),
    schemes: await prisma.scheme.count(),
    benchmarks: await prisma.benchmark.count(),
    action_library: await prisma.actionLibrary.count(),
  };
  for (const [table, n] of Object.entries(counts)) console.log(`${table}: ${n}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
