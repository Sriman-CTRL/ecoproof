const indian = new Intl.NumberFormat('en-IN');
const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** Indian digit grouping, e.g. 100000 -> "1,00,000". */
export const formatNumber = (n: number): string => indian.format(n);

/** Rupee amount with Indian grouping, e.g. 60000 -> "₹60,000". */
export const formatInr = (n: number): string => inr.format(n);
