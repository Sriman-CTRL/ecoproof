import { InvalidInputError } from './errors';

export interface BillToValidate {
  billNo: string;
  /** ISO date, first day of the billing period (inclusive). */
  periodStart: string;
  /** ISO date, last day of the billing period (inclusive). */
  periodEnd: string;
  kwh: number;
  kvah: number;
  pf: number;
  sanctionedLoadKw: number;
}

export interface BillHistoryEntry {
  billNo: string;
  periodStart: string;
  periodEnd: string;
  kwh: number;
}

export interface BillValidationResult {
  errors: string[];
  needsConfirmation: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const PF_MIN = 0.5;
const PF_MAX = 1.0;
const MAX_CHANGE = 0.5;

function parseDay(name: string, iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new InvalidInputError(`${name} is not an ISO date: ${iso}`);
  return t;
}

/**
 * Doc 03 "Validation rules before a value is accepted". Periods are inclusive of both
 * end dates (1 Apr - 30 Apr = 30 days = 720 h).
 */
export function validateBill(input: {
  bill: BillToValidate;
  history: BillHistoryEntry[];
}): BillValidationResult {
  const { bill, history } = input;
  const errors: string[] = [];
  const needsConfirmation: string[] = [];
  const start = parseDay('periodStart', bill.periodStart);
  const end = parseDay('periodEnd', bill.periodEnd);

  if (end < start) errors.push('Billing period ends before it starts');
  if (history.some((h) => h.billNo === bill.billNo)) {
    errors.push(`Duplicate bill number ${bill.billNo}`);
  }
  for (const h of history) {
    const hStart = parseDay('history periodStart', h.periodStart);
    const hEnd = parseDay('history periodEnd', h.periodEnd);
    if (start <= hEnd && hStart <= end) {
      errors.push(`Billing period overlaps bill ${h.billNo} (${h.periodStart} to ${h.periodEnd})`);
    }
  }
  if (bill.kwh > bill.kvah) errors.push('kWh is greater than kVAh');
  if (!(bill.pf >= PF_MIN && bill.pf <= PF_MAX)) {
    errors.push(`Power factor ${bill.pf} is outside ${PF_MIN}-${PF_MAX}`);
  }
  const hours = ((end - start) / DAY_MS + 1) * 24;
  const maxKwh = bill.sanctionedLoadKw * hours;
  if (bill.kwh > maxKwh) {
    errors.push(`kWh ${bill.kwh} exceeds sanctioned load x hours in period (${maxKwh})`);
  }

  const previous = history
    .filter((h) => parseDay('history periodEnd', h.periodEnd) < start)
    .sort((x, y) => parseDay('', y.periodEnd) - parseDay('', x.periodEnd))[0];
  if (previous && previous.kwh > 0) {
    const change = (bill.kwh - previous.kwh) / previous.kwh;
    if (Math.abs(change) > MAX_CHANGE) {
      needsConfirmation.push(
        `kWh changed ${Math.round(change * 100)}% vs bill ${previous.billNo}; please confirm`,
      );
    }
  }

  return { errors, needsConfirmation };
}
