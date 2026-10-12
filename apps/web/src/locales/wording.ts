/**
 * Banned words and approved phrases. Keep in step with the "UI rules" section of CLAUDE.md
 * (docs/design/04-ui-design-plan.md section 7).
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
  'Not an energy audit',
  'ZED certification',
  'ZED certificate',
] as const;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Banned words found in `text` (whole words, any case), after removing the approved phrases. */
export function findBanned(text: string): string[] {
  let rest = text;
  for (const phrase of ALLOWED) rest = rest.replace(new RegExp(escape(phrase), 'gi'), ' ');
  return BANNED.filter((w) =>
    new RegExp(`(^|[^\\p{L}\\p{N}-])${escape(w)}($|[^\\p{L}\\p{N}-])`, 'iu').test(rest),
  );
}
