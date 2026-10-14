import type { CheckResult } from '@ecoproof/calc';
import { checkGstin, udyamFormat } from '@ecoproof/shared';
import type { BusinessCheck, Organisation, Site } from '@prisma/client';
import { prisma } from '../db.js';
import { DEMO_ORG_IDS, ORG_A } from '../demo/ids.js';

/**
 * D8/D89 business check (findings-business-check section 6). Level 2 is "Matched to documents";
 * level 3 (checked with the government record through DigiLocker) is not reachable yet.
 */
export type BusinessLevel = 'none' | 'self_declared' | 'matched_documents';

export interface BusinessCheckItem {
  code:
    | 'udyam_format'
    | 'gstin_format'
    | 'udyam_match'
    | 'name_match'
    | 'state_match'
    | 'pan_match'
    | 'manufacturing'
    | 'meter_unique';
  result: CheckResult;
  line: string;
}

export const LEVEL_TEXT: Record<BusinessLevel, string> = {
  none: 'Not checked yet',
  self_declared: 'Self-declared',
  matched_documents: 'Matched to documents',
};

export const LEVEL3_LINE =
  'Coming: checked with the government record through DigiLocker, after EcoProof is a registered company';

/** What EcoProof keeps from a Udyam certificate: these business details only, never the file. */
export interface UdyamDocFields {
  udyamNo: string;
  enterpriseName: string;
  state: string;
  majorActivity: string;
  /** True for the bundled sample (demo mode). */
  isSample: boolean;
}

/**
 * Demo mode reader for the Udyam certificate: a fixed SYNTHETIC sample matching Demo A. A real
 * certificate reader is not built yet, so other orgs get "can't read" rather than a made-up match.
 */
export function readUdyamCertificate(orgId: string): UdyamDocFields | null {
  if (orgId !== ORG_A && !DEMO_ORG_IDS.includes(orgId)) return null;
  return {
    udyamNo: 'UDYAM-SAMPLE-0001',
    enterpriseName: 'Sri Lakshmi Castings (sample)',
    state: 'Telangana',
    majorActivity: 'Manufacturing',
    isSample: true,
  };
}

const norm = (s: string) =>
  s
    .toUpperCase()
    .replace(/\(SAMPLE[^)]*\)/g, '')
    .replace(/\b(M\/S|PVT|PRIVATE|LTD|LIMITED|LLP)\b\.?/g, '')
    .replace(/[^A-Z0-9]/g, '');

export interface TypedNumbers {
  udyamNo: string;
  gstin: string | null;
  consumerNo: string;
}

/** Another org already holds this electricity consumer number (one meter = one business). */
export async function consumerNoTaken(orgId: string, consumerNo: string): Promise<boolean> {
  const other = await prisma.site.findFirst({
    where: { consumerNo: consumerNo.trim(), orgId: { not: orgId } },
    select: { id: true },
  });
  return other != null;
}

export function typedChecks(t: TypedNumbers, taken: boolean): BusinessCheckItem[] {
  const u = udyamFormat(t.udyamNo);
  const items: BusinessCheckItem[] = [
    {
      code: 'udyam_format',
      result: u === 'bad' ? 'flag' : 'pass',
      line:
        u === 'sample'
          ? 'Sample number (demo).'
          : u === 'ok'
            ? 'Udyam number has the right shape (UDYAM-XX-00-0000000).'
            : 'A Udyam number looks like UDYAM-XX-00-0000000. Please check it.',
    },
  ];
  if (!t.gstin) {
    items.push({ code: 'gstin_format', result: 'cant_check', line: 'No GSTIN given (optional).' });
  } else {
    const g = checkGstin(t.gstin);
    items.push({
      code: 'gstin_format',
      result: g.ok ? 'pass' : 'flag',
      line: g.ok
        ? 'GSTIN: Telangana state code 36, PAN shape, "Z" and check digit all fit.'
        : (g.problem ?? 'GSTIN does not fit the pattern.'),
    });
  }
  items.push({
    code: 'meter_unique',
    result: taken ? 'flag' : 'pass',
    line: taken
      ? 'This electricity consumer number is already linked to another business on EcoProof.'
      : 'This electricity consumer number belongs to no other business on EcoProof.',
  });
  return items;
}

export function documentChecks(
  t: TypedNumbers,
  org: Pick<Organisation, 'name' | 'state'>,
  doc: UdyamDocFields,
): BusinessCheckItem[] {
  const typedState = t.gstin ? checkGstin(t.gstin).stateCode : null;
  const stateOk =
    doc.state.toLowerCase() === 'telangana' &&
    (typedState == null || typedState === '36') &&
    (org.state == null || org.state.toLowerCase() === 'telangana');
  return [
    {
      code: 'udyam_match',
      result: doc.udyamNo.toUpperCase() === t.udyamNo.trim().toUpperCase() ? 'pass' : 'flag',
      line: `Udyam number on the certificate: ${doc.udyamNo}.`,
    },
    {
      code: 'name_match',
      result: norm(doc.enterpriseName) === norm(org.name) ? 'pass' : 'flag',
      line: `Name on the certificate: ${doc.enterpriseName}.`,
    },
    {
      code: 'state_match',
      result: stateOk ? 'pass' : 'flag',
      line: `State on the certificate: ${doc.state}${typedState ? `; GSTIN state code ${typedState}` : ''}.`,
    },
    {
      code: 'pan_match',
      result: 'cant_check',
      line: "Can't check: there is no PAN to compare with. EcoProof does not ask for or keep a PAN.",
    },
    {
      code: 'manufacturing',
      result: doc.majorActivity.toLowerCase() === 'manufacturing' ? 'pass' : 'flag',
      line: `Major activity on the certificate: ${doc.majorActivity}.`,
    },
  ];
}

export function levelOf(items: BusinessCheckItem[], hasDoc: boolean): BusinessLevel {
  const res = (c: BusinessCheckItem['code']) => items.find((i) => i.code === c)?.result;
  const typedOk =
    res('udyam_format') === 'pass' &&
    res('gstin_format') !== 'flag' &&
    res('meter_unique') === 'pass';
  if (!typedOk) return 'none';
  if (!hasDoc) return 'self_declared';
  const docOk = (['udyam_match', 'name_match', 'state_match', 'manufacturing'] as const).every(
    (c) => res(c) === 'pass',
  );
  return docOk ? 'matched_documents' : 'self_declared';
}

/** View for the web, Home and the statements. Without a row, the typed numbers on file count. */
export async function businessCheckView(org: Organisation, site: Site, row?: BusinessCheck | null) {
  const r =
    row === undefined ? await prisma.businessCheck.findUnique({ where: { orgId: org.id } }) : row;
  let checks: BusinessCheckItem[];
  let level: BusinessLevel;
  if (r) {
    checks = r.checksJson as unknown as BusinessCheckItem[];
    level = r.level as BusinessLevel;
  } else if (org.udyamNo && site.consumerNo) {
    checks = typedChecks(
      { udyamNo: org.udyamNo, gstin: org.gstin, consumerNo: site.consumerNo },
      await consumerNoTaken(org.id, site.consumerNo),
    );
    level = levelOf(checks, false);
  } else {
    checks = [];
    level = 'none';
  }
  const counted = checks.filter((c) => c.result !== 'cant_check');
  return {
    saved: r != null,
    level,
    levelText: LEVEL_TEXT[level],
    levelNumber: level === 'matched_documents' ? 2 : level === 'self_declared' ? 1 : 0,
    level3Line: LEVEL3_LINE,
    passed: counted.filter((c) => c.result === 'pass').length,
    total: checks.length,
    checks,
    numbers: {
      udyamNo: r?.udyamNo ?? org.udyamNo,
      gstin: r?.gstin ?? org.gstin,
      consumerNo: r?.consumerNo ?? site.consumerNo,
    },
    doc: (r?.docJson as UdyamDocFields | null) ?? null,
    isSample: r?.isSample ?? DEMO_ORG_IDS.includes(org.id),
  };
}

export type BusinessCheckView = Awaited<ReturnType<typeof businessCheckView>>;

/** The one statement line (D89 item 12). */
export const businessStatementLine = (
  v: Pick<BusinessCheckView, 'levelText' | 'passed' | 'total'>,
) =>
  `Business check: ${v.levelText} (${v.passed} of ${v.total} checks passed). Not checked with the government record.`;
