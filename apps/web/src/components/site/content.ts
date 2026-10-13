/** Shared lists for the public site pages (D6b). */
export const STAGES = ['s1', 's2', 's3', 's4', 's5', 's6'] as const;
export const SDG_ROWS = ['track', 'reduce', 'insights', 'incentives', 'who'] as const;

/** Demo B's loan-ready summary: fixed id in apps/api/src/demo/ids.ts (DEMO_REPORT_ID). */
export const DEMO_REPORT_ID =
  (import.meta.env.VITE_DEMO_REPORT_ID as string | undefined) ??
  '5d3a0a10-0000-4000-8000-0000000000c1';
/** Demo A's carbon statement, also on the pitch deck QR (DEMO_CARBON_STATEMENT_ID). */
export const DEMO_CARBON_STATEMENT_ID = 'cff77d8b-daca-4276-85d9-c44c7556f966';

/** "2026-10-01" -> "Oct 2026" (or the Telugu / Hindi month), for sample-data tags. */
export function monthYear(iso: string, lang: string): string {
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-IN' : lang, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
}
