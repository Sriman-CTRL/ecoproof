const t1 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * One plain sentence for a carbon total with its parts, e.g.
 * "66.8 t CO2 (63.6 t from grid electricity, 3.2 t from diesel)".
 * Scope 1 is diesel only today (the only fuel factor used); the fuel part is dropped when it is 0.
 */
export function carbonSentence(p: { scope2T: number; scope1T: number }): string {
  const grid = round1(p.scope2T);
  const fuel = round1(p.scope1T);
  const total = round1(p.scope2T + p.scope1T);
  if (fuel <= 0) return `${t1.format(total)} t CO2 (all from grid electricity)`;
  return `${t1.format(total)} t CO2 (${t1.format(grid)} t from grid electricity, ${t1.format(fuel)} t from diesel)`;
}
