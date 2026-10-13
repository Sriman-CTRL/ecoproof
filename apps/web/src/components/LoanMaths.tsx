import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cashTest, emi as emiOf } from '@ecoproof/calc';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { EmiVsSavingBar } from './kit/EmiVsSavingBar';
import { StatusPill } from './kit/StatusPill';
import { actionCo2Text } from './ui';
import { formatInr } from '../lib/format';
import { useInrInput } from '../lib/useInrInput';

/** Loan amount, rate and months, parsed once for the EMI (FIN-3). Shared by landing and detail. */
export function useLoanTerms(init: { loan: number | null; ratePct: number; months: number }) {
  const loan = useInrInput(init.loan);
  const [rate, setRate] = useState(String(init.ratePct));
  const [months, setMonths] = useState(String(init.months));
  const principal = loan.value;
  const tenure = Math.floor(Number(months));
  const annualRate = Number(rate);
  const valid = principal > 0 && tenure > 0 && annualRate >= 0 && Number.isFinite(annualRate);
  return {
    loan,
    rate,
    setRate: (v: string) => setRate(v.replace(/[^\d.]/g, '')),
    months,
    setMonths: (v: string) => setMonths(v.replace(/\D/g, '')),
    principal,
    annualRate,
    tenure,
    emi: valid ? emiOf({ principal, annualRatePct: annualRate, months: tenure }) : null,
  };
}
export type LoanTerms = ReturnType<typeof useLoanTerms>;

export function LoanTermInputs({
  terms,
  labels,
  className = 'mt-1 min-h-12 w-full rounded-button border bg-surface px-3 text-body',
}: {
  terms: LoanTerms;
  labels: { loan: string; rate: string; months: string; rateHelp?: string };
  className?: string;
}) {
  return (
    <div className="grid grid-cols-2 items-end gap-3">
      <label className="col-span-2 block text-small">
        <span className="font-semibold">{labels.loan}</span>
        <input className={`${className} num`} {...terms.loan.inputProps} />
      </label>
      <label className="block text-small">
        <span className="font-semibold">{labels.rate}</span>
        <input
          inputMode="decimal"
          className={`${className} num`}
          value={terms.rate}
          onChange={(e) => terms.setRate(e.target.value)}
        />
      </label>
      <label className="block text-small">
        <span className="font-semibold">{labels.months}</span>
        <input
          inputMode="numeric"
          className={`${className} num`}
          value={terms.months}
          onChange={(e) => terms.setMonths(e.target.value)}
        />
      </label>
      {labels.rateHelp && <p className="col-span-2 text-small text-ink-muted">{labels.rateHelp}</p>}
    </div>
  );
}

/**
 * EMI vs the low-end saving, the saving range, the CO2 the measure cuts (same kWh basis as the
 * rupees, D6a) and the bill fixes that can cover a gap. Every figure is passed in from the API.
 */
export function LoanResult({
  emi,
  savingLow,
  savingHigh,
  co2,
  billFixesInr,
}: {
  emi: number;
  savingLow: number;
  savingHigh: number | null;
  co2: { tPerYearLow: number; tPerYearHigh: number } | null;
  billFixesInr: number | null;
}) {
  const { t } = useTranslation();
  const test = cashTest({ emi, monthlySavingLow: savingLow });
  const co2Text = co2 ? actionCo2Text({ co2, co2Note: null }, t) : null;
  return (
    <div className="space-y-3" data-testid="loan-result">
      <EmiVsSavingBar emi={Math.round(emi)} saving={Math.round(savingLow)} lowEnd />
      {savingHigh != null && Math.round(savingHigh) !== Math.round(savingLow) && (
        <p className="num text-small text-ink-muted">
          {t('loanMaths.savingRange', {
            low: formatInr(Math.round(savingLow)),
            high: formatInr(Math.round(savingHigh)),
          })}
        </p>
      )}
      {test.cashPositiveFromMonth1 && (
        <StatusPill tone="positive">
          <CheckCircle size={18} weight="fill" aria-hidden="true" />
          {t('detail.cashPositive')}
        </StatusPill>
      )}
      {co2Text && (
        <p
          className="num font-heading text-card-title font-semibold text-green-700"
          data-testid="loan-co2"
        >
          {t('loanMaths.cuts', { text: co2Text })}
        </p>
      )}
      {billFixesInr != null && billFixesInr > 0 && (
        <p className="num rounded-card bg-paper p-3 text-small font-semibold">
          {t('loanMaths.billFixes', { amount: formatInr(Math.round(billFixesInr)) })}
        </p>
      )}
    </div>
  );
}
