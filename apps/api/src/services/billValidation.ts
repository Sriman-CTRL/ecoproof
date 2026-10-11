import { validateBill } from '@ecoproof/calc';
import type { PowerBillFields } from '@ecoproof/shared';
import type { Site } from '@prisma/client';
import { prisma } from '../db.js';

export interface BillValidation {
  errors: string[];
  needsConfirmation: string[];
  /** Field names implicated by an error or confirmation item. */
  flaggedFields: string[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Message -> fields it points at, so the confirm screen can highlight them. */
function fieldsFor(message: string): string[] {
  const m = message.toLowerCase();
  if (m.includes('overlap') || m.includes('period')) return ['periodStart', 'periodEnd'];
  if (m.includes('duplicate bill')) return ['billNo'];
  if (m.includes('kwh is greater than kvah')) return ['kwh', 'kvah'];
  if (m.includes('power factor')) return ['pf'];
  if (m.includes('sanctioned load')) return ['kwh'];
  if (m.includes('consumer')) return ['consumerNo'];
  if (m.includes('kwh changed')) return ['kwh'];
  return [];
}

export async function validateFields(site: Site, fields: PowerBillFields): Promise<BillValidation> {
  const months = await prisma.energyMonth.findMany({
    where: { orgId: site.orgId, siteId: site.id },
    orderBy: { periodStart: 'asc' },
  });
  // energy_months has no bill number; recover it from confirmed extractions of this site.
  const confirmed = await prisma.extraction.findMany({
    where: { orgId: site.orgId, confirmedAt: { not: null }, document: { siteId: site.id } },
    select: { fieldsJson: true },
  });
  const billNoByStart = new Map<string, string>();
  for (const e of confirmed) {
    const f = e.fieldsJson as Partial<PowerBillFields>;
    if (f.periodStart && f.billNo) billNoByStart.set(f.periodStart, f.billNo);
  }
  const history = months.map((m) => ({
    billNo: billNoByStart.get(iso(m.periodStart)) ?? `month:${iso(m.periodStart)}`,
    periodStart: iso(m.periodStart),
    periodEnd: iso(m.periodEnd),
    kwh: Number(m.kwh ?? 0),
  }));

  const needsConfirmation: string[] = [];
  const sanctioned = site.sanctionedLoadKw == null ? null : Number(site.sanctionedLoadKw);
  if (sanctioned == null) {
    needsConfirmation.push('Sanctioned load is not on file, so the kWh limit check was skipped');
  }
  const result = validateBill({
    bill: {
      billNo: fields.billNo,
      periodStart: fields.periodStart,
      periodEnd: fields.periodEnd,
      kwh: fields.kwh,
      kvah: fields.kvah,
      pf: fields.pf,
      sanctionedLoadKw: sanctioned ?? Number.POSITIVE_INFINITY,
    },
    history,
  });
  const errors = [...result.errors];
  if (site.consumerNo && fields.consumerNo !== site.consumerNo) {
    errors.push(
      `Consumer number ${fields.consumerNo} does not match this site (${site.consumerNo})`,
    );
  }
  needsConfirmation.push(...result.needsConfirmation);
  const flaggedFields = [...new Set([...errors, ...needsConfirmation].flatMap(fieldsFor))];
  return { errors, needsConfirmation, flaggedFields };
}

export const LOW_CONFIDENCE = 0.8;

export function lowConfidenceFields(
  confidence: Record<string, number>,
  validation: BillValidation,
): string[] {
  const low = Object.entries(confidence)
    .filter(([, c]) => c < LOW_CONFIDENCE)
    .map(([k]) => k);
  return [...new Set([...low, ...validation.flaggedFields])];
}
