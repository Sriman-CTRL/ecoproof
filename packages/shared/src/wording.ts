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
