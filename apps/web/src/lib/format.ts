const indian = new Intl.NumberFormat('en-IN');
const indian2 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const rate = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** Indian digit grouping, e.g. 100000 -> "1,00,000". */
export const formatNumber = (n: number): string => indian.format(n);

/** Up to 2 decimals with Indian grouping, for tonnes and intensities. */
export const formatDecimal = (n: number): string => indian2.format(n);

const factor3 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 });
/** An emission factor exactly as published, up to 3 decimals, e.g. 0.675 -> "0.675". */
export const formatFactor = (n: number): string => factor3.format(n);

/** A per-unit rupee rate, always 2 decimals (paise), e.g. 7.5 -> "7.50". */
export const formatRate = (n: number): string => rate.format(n);

/** Rupee amount with Indian grouping, e.g. 60000 -> "₹60,000". */
export const formatInr = (n: number): string => inr.format(n);

/** Lakh/crore scale for amounts of Rs 1 lakh or more, e.g. 2500000 -> { amount: "25", unit: "lakh" }. */
export function inrScale(n: number): { amount: string; unit: 'lakh' | 'crore' } | null {
  const a = Math.abs(n);
  if (a >= 1e7) return { amount: indian2.format(Math.round((n / 1e7) * 100) / 100), unit: 'crore' };
  if (a >= 1e5) return { amount: indian2.format(Math.round((n / 1e5) * 100) / 100), unit: 'lakh' };
  return null;
}

/** Words for amounts over Rs 1 lakh, e.g. 2500000 -> "25 lakh". Empty below 1 lakh. */
export function inrWords(n: number): string {
  const s = inrScale(n);
  return s ? `${s.amount} ${s.unit}` : '';
}

/** Digits only, as a number: "27,75,000" -> 2775000, "" -> 0. */
export const parseDigits = (s: string): number => Number(s.replace(/\D/g, '')) || 0;

/** Plain digits shown with Indian grouping once the field is left: "2775000" -> "27,75,000". */
export function displayDigits(s: string): string {
  const n = parseDigits(s);
  return n ? formatNumber(n) : '';
}
