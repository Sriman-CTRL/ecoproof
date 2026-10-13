import { useTranslation } from 'react-i18next';
import { LoanResult, LoanTermInputs, useLoanTerms } from '../LoanMaths';
import type { ActionItem } from '../../lib/api';
import { LOAN_EXAMPLE_CODE, usePublicSample } from '../../lib/publicSample';
import { formatInr } from '../../lib/format';
import { SAMPLE_BILL } from '../../lib/sampleBill';
import { SampleSkeleton } from './SampleSkeleton';

/** Loads the sample foundry's action plan, then shows the IGBT worked example. */
export function SampleLoanExample() {
  const sample = usePublicSample();
  const igbt = sample.data?.actions.find((a) => a.code === LOAN_EXAMPLE_CODE);
  if (igbt && igbt.inrPerMonthLow != null) return <LoanExample igbt={igbt} />;
  return <SampleSkeleton error={sample.isError} />;
}

/** The same example, result only (default terms), for compact cards. */
export function SampleLoanResult() {
  const sample = usePublicSample();
  const igbt = sample.data?.actions.find((a) => a.code === LOAN_EXAMPLE_CODE);
  if (igbt && igbt.inrPerMonthLow != null) return <IgbtResult igbt={igbt} />;
  return <SampleSkeleton error={sample.isError} />;
}

function IgbtResult({ igbt }: { igbt: ActionItem }) {
  const { t } = useTranslation();
  const terms = useLoanTerms(EXAMPLE_TERMS(igbt));
  return (
    <div className="space-y-3">
      <p className="font-semibold">
        {t('landing.money.measure', {
          title: t(`actions.name.${igbt.code}`, { defaultValue: igbt.title }),
        })}
      </p>
      <p className="num text-small text-ink-muted">
        {t('site.loanTerms', {
          loan: formatInr(terms.principal),
          rate: terms.rate,
          months: terms.months,
        })}
      </p>
      {terms.emi != null && (
        <LoanResult
          emi={terms.emi}
          savingLow={igbt.inrPerMonthLow!}
          savingHigh={igbt.inrPerMonthHigh}
          co2={igbt.co2}
          billFixesInr={SAMPLE_BILL.atStakeInr}
        />
      )}
      <p className="text-small text-ink-muted">{t('landing.money.small')}</p>
    </div>
  );
}

// SIDBI 4E repayment is up to 84 months (findings-all.md R8); 8% a year is the example rate.
const EXAMPLE_TERMS = (igbt: ActionItem) => ({ loan: igbt.costLow, ratePct: 8, months: 84 });

function LoanExample({ igbt }: { igbt: ActionItem }) {
  const { t } = useTranslation();
  const terms = useLoanTerms(EXAMPLE_TERMS(igbt));
  return (
    <div className="grid items-start gap-8 md:grid-cols-2">
      <div className="space-y-4">
        <p className="font-semibold">
          {t('landing.money.measure', {
            title: t(`actions.name.${igbt.code}`, { defaultValue: igbt.title }),
          })}
        </p>
        <LoanTermInputs
          terms={terms}
          labels={{
            loan: t('landing.money.loan'),
            rate: t('landing.money.rate'),
            months: t('landing.money.months'),
          }}
        />
      </div>
      <div className="space-y-3 rounded-card border bg-surface p-4 shadow-card" data-testid="money">
        {terms.emi != null && (
          <LoanResult
            emi={terms.emi}
            savingLow={igbt.inrPerMonthLow!}
            savingHigh={igbt.inrPerMonthHigh}
            co2={igbt.co2}
            billFixesInr={SAMPLE_BILL.atStakeInr}
          />
        )}
        <p className="text-small font-semibold text-copper-800">{t('landing.money.example')}</p>
        <p className="text-small text-ink-muted">{t('landing.money.small')}</p>
      </div>
    </div>
  );
}
