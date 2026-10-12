// Shared HTML helpers for the PDF reports (loan-ready summary, carbon statement).

const groupInt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const group2 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
/** Rupees with Indian grouping, e.g. 100000 -> "Rs 1,00,000". */
export const inr = (n: number) => `Rs ${groupInt.format(Math.round(n))}`;
export const int = (n: number | null) => (n == null ? '-' : groupInt.format(n));
export const dec = (n: number | null) => (n == null ? '-' : group2.format(n));

export const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/** {{text}} is escaped, {{{raw}}} is not; a missing key is a bug, so it throws. */
export function fill(name: string, tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\{(\w+)\}\}\}|\{\{(\w+)\}\}/g, (_m, raw?: string, text?: string) => {
    const key = (raw ?? text)!;
    const v = vars[key];
    if (v == null) throw new Error(`${name} template: missing ${key}`);
    return raw ? v : esc(v);
  });
}

export const monthName = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
export const dateText = (isoTs: string) =>
  new Date(isoTs).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

export function table(head: string[], rows: string[][], numeric: number[] = []): string {
  const cls = (i: number) => (numeric.includes(i) ? ' class="num"' : '');
  return `<table><thead><tr>${head.map((h, i) => `<th${cls(i)}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c, i) => `<td${cls(i)}>${esc(c)}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
}

/** Playwright footer, repeated on every page. Inline styles only (Chromium footer rules). */
export function footerHtml(line: string, reportId: string, verifyUrl: string): string {
  return `<div style="font-family: Arial, sans-serif; font-size: 7.5pt; color: #374151; width: 100%; padding: 0 14mm; display: flex; justify-content: space-between; gap: 4mm;">
  <span><b>${esc(line)}</b><br />Report ID ${esc(reportId)} · Verify: ${esc(verifyUrl)}</span>
  <span style="white-space: nowrap;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
</div>`;
}
