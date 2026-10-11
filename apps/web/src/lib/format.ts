const indian = new Intl.NumberFormat('en-IN');
const indian2 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** Indian digit grouping, e.g. 100000 -> "1,00,000". */
export const formatNumber = (n: number): string => indian.format(n);

/** Up to 2 decimals with Indian grouping, for tonnes and intensities. */
export const formatDecimal = (n: number): string => indian2.format(n);

/** Rupee amount with Indian grouping, e.g. 60000 -> "₹60,000". */
export const formatInr = (n: number): string => inr.format(n);

/** Words for amounts over Rs 1 lakh, e.g. 2500000 -> "25 lakh". Empty below 1 lakh. */
export function inrWords(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e7) return `${indian2.format(Math.round((n / 1e7) * 100) / 100)} crore`;
  if (a >= 1e5) return `${indian2.format(Math.round((n / 1e5) * 100) / 100)} lakh`;
  return '';
}
