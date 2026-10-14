/**
 * Banned words and approved phrases. Keep in step with the "UI rules" section of CLAUDE.md
 * (docs/design/04-ui-design-plan.md section 7). Used by the web locale tests and the API
 * report tests (scheme matcher, CBAM sheet).
 */
export const BANNED = [
  'audit',
  'approved',
  'sanctioned',
  'eligible',
  'certified',
  'compliant',
  'certificate',
  'verified',
  'green certified',
  'eco-friendly',
  'carbon neutral',
  'sustainable unit',
  'green factory',
] as const;

/** Exact phrases that may contain a banned word; stripped before the scan. */
export const ALLOWED = [
  'Verified by your bills',
  'Estimate, not verified',
  'Likely eligible; confirm with the scheme office',
  // Doc 02 FIN-1: the matcher says "not eligible" with the reason. Never the bare word "eligible".
  'Not eligible',
  // Doc 05 CBAM sheet status line.
  'Verified data must be confirmed by an accredited verifier',
  'Not an energy audit',
  'ZED certification',
  'ZED certificate',
  // CERTIFICATE RULE (Sriman, 13 Oct 2026): only for a confirmed Mitra step. EcoProof never
  // certifies emissions, savings or green status.
  'Certificate of Participation',
  // D89 (Sriman, 13 Oct 2026): the government's own Udyam document; EcoProof outputs are never certificates.
  'Udyam certificate',
] as const;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Banned words found in `text` (whole words, any case), after removing the approved phrases.
 * `quotedLines` are stored source quotes (a tariff row's quoted_line): when one appears inside
 * quote marks (“…” or "…") it is the source's wording, not EcoProof's, so it is skipped.
 */
export function findBanned(text: string, quotedLines: readonly string[] = []): string[] {
  let rest = text;
  for (const q of quotedLines.filter(Boolean)) {
    for (const [open, close] of [
      ['“', '”'],
      ['"', '"'],
    ] as const) {
      rest = rest.split(`${open}${q}${close}`).join(' ');
    }
  }
  for (const phrase of ALLOWED) rest = rest.replace(new RegExp(escape(phrase), 'gi'), ' ');
  return BANNED.filter((w) =>
    new RegExp(`(^|[^\\p{L}\\p{N}-])${escape(w)}($|[^\\p{L}\\p{N}-])`, 'iu').test(rest),
  );
}

/**
 * Extra words banned in Mitra text (NGO and government help): EcoProof is not part of any
 * programme, and nothing is worded as a legal duty (Sriman, 13 Oct 2026). Mitra strings only:
 * "Partner offer" is a valid label elsewhere.
 */
export const MITRA_BANNED = [
  'partner',
  'partners',
  'partnered',
  'official',
  'in association with',
  'on behalf of',
  'on behalf',
  'guarantee',
  'guaranteed',
  'mandatory',
  'you must',
  'we will apply',
] as const;

/** `findBanned` plus the Mitra words; stored source quotes in quote marks are skipped. */
export function findMitraBanned(text: string, quotedLines: readonly string[] = []): string[] {
  let rest = text;
  for (const q of quotedLines.filter(Boolean)) {
    for (const [open, close] of [
      ['“', '”'],
      ['"', '"'],
    ] as const) {
      rest = rest.split(`${open}${q}${close}`).join(' ');
    }
  }
  return [
    ...findBanned(rest),
    ...MITRA_BANNED.filter((w) =>
      new RegExp(`(^|[^\\p{L}\\p{N}-])${escape(w)}($|[^\\p{L}\\p{N}-])`, 'iu').test(rest),
    ),
  ];
}
