import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { cashTest, emi } from '@ecoproof/calc';
import { CostText, ErrorBox, Page, PRIMARY, Rupees, SourceNumber } from '../components/ui';
import { postJson, type LoanPackCreated } from '../lib/api';
import { formatDecimal, formatInr } from '../lib/format';
import { getSession } from '../lib/session';
import { actionTitle, useActions } from './Actions';

const digits = (s: string) => Number(s.replace(/[^\d]/g, '')) || 0;

export default function ActionDetail() {
  const { t } = useTranslation();
  const { code = '' } = useParams();
  const [params] = useSearchParams();
  const month = params.get('month');
  const siteId = getSession()?.siteId ?? '';
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useActions(month, true);
  const a = q.data?.actions.find((x) => x.code === code);

  const [loan, setLoan] = useState('');
  const [rate, setRate] = useState('8');
  const [months, setMonths] = useState('60');
  const [vendor, setVendor] = useState('');
  const [quote, setQuote] = useState('');
  const plan = useMutation({
    mutationFn: () => postJson(`/sites/${siteId}/actions/${code}/plan`, { status: 'planned' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['actions'] }),
  });

  const principal = digits(loan);
  const tenure = Math.floor(Number(months));
  const annualRate = Number(rate);
  const valid = principal > 0 && tenure > 0 && annualRate >= 0 && Number.isFinite(annualRate);
  const monthlyLow = a?.inrPerMonthLow ?? 0;
  const calc = valid
    ? (() => {
        const e = emi({ principal, annualRatePct: annualRate, months: tenure });
        return { emi: e, test: cashTest({ emi: e, monthlySavingLow: monthlyLow }) };
      })()
    : null;
  const planned = plan.isSuccess || (a != null && a.status !== 'suggested');
  const quoteInr = digits(quote);
  const makePack = useMutation({
    mutationFn: () =>
      postJson<LoanPackCreated>(`/sites/${siteId}/reports/loan-pack`, {
        actionCode: code,
        ...(quoteInr > 0
          ? { quote: { vendorName: vendor.trim() || '-', amountInr: quoteInr } }
          : {}),
        loan: { amountInr: principal, ratePct: annualRate, tenureMonths: tenure },
        language: 'en',
      }),
    onSuccess: (r) => navigate(`/reports/${r.reportId}`),
  });

  return (
    <Page
      action={
        planned ? (
          <button
            type="button"
            className={PRIMARY}
            disabled={!a || !calc || a.inrPerMonthLow == null || makePack.isPending}
            onClick={() => makePack.mutate()}
          >
            {makePack.isPending ? t('detail.making') : t('detail.makePack')}
          </button>
        ) : (
          <button
            type="button"
            className={PRIMARY}
            disabled={!a || plan.isPending}
            onClick={() => plan.mutate()}
          >
            {t('detail.plan')}
          </button>
        )
      }
    >
      {q.isLoading && <p>{t('common.loading')}</p>}
      {q.isError && <ErrorBox>{t('actions.loadFailed')}</ErrorBox>}
      {(plan.isError || makePack.isError) && <ErrorBox>{t('common.genericError')}</ErrorBox>}
      {q.isSuccess && !a && <ErrorBox>{t('detail.notFound')}</ErrorBox>}
      {a && (
        <>
          <h1 className="text-xl font-bold">{actionTitle(a, t)}</h1>
          <section className="space-y-2 rounded-2xl bg-white p-5 shadow-sm">
            {a.inrPerMonthLow != null ? (
              <>
                <p className="text-3xl font-bold">
                  <SourceNumber source={a.source}>
                    <Rupees value={a.inrPerMonthLow} />
                  </SourceNumber>{' '}
                  <span className="text-base font-normal text-gray-600">
                    {t('health.perMonth')}
                  </span>
                </p>
                {a.annualInrMid != null && (
                  <p className="text-gray-700">
                    <Rupees value={a.annualInrMid} /> {t('actions.perYear')}
                  </p>
                )}
              </>
            ) : (
              <p className="font-semibold">
                {t(a.finding ? 'actions.savingPending' : 'actions.savingPendingOther')}
              </p>
            )}
            <p>
              {t('actions.cost')}: <CostText low={a.costLow} high={a.costHigh} />
            </p>
            <p>
              {t('actions.payback')}:{' '}
              {a.paybackYears != null
                ? t('actions.years', { n: formatDecimal(a.paybackYears) })
                : '-'}
            </p>
            {a.co2Note && <p className="text-xs text-gray-600">{t('detail.noCo2')}</p>}
          </section>

          <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="font-semibold">{t('detail.emiTitle')}</h2>
            <label className="block text-sm">
              <span className="font-medium">{t('detail.loan')}</span>
              <input
                inputMode="numeric"
                className="mt-1 min-h-12 w-full rounded-lg border px-3 text-base"
                value={loan}
                onChange={(e) => {
                  const n = digits(e.target.value);
                  setLoan(n ? new Intl.NumberFormat('en-IN').format(n) : '');
                }}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">{t('detail.rate')}</span>
              <input
                inputMode="decimal"
                className="mt-1 min-h-12 w-full rounded-lg border px-3 text-base"
                value={rate}
                onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ''))}
              />
              <span className="text-xs text-gray-600">{t('detail.rateHelp')}</span>
            </label>
            <label className="block text-sm">
              <span className="font-medium">{t('detail.tenure')}</span>
              <input
                inputMode="numeric"
                className="mt-1 min-h-12 w-full rounded-lg border px-3 text-base"
                value={months}
                onChange={(e) => setMonths(e.target.value.replace(/[^\d]/g, ''))}
              />
            </label>
            {calc && (
              <div className="space-y-1 border-t pt-3" data-testid="emi-panel">
                <p>
                  {t('detail.emi')}: <b>{formatInr(Math.round(calc.emi))}</b>
                </p>
                <p>
                  {t('detail.savingLow')}: <b>{formatInr(Math.round(monthlyLow))}</b>
                </p>
                <p>
                  {t('detail.difference')}: <b>{formatInr(Math.round(calc.test.netMonthly))}</b>
                </p>
                {calc.test.cashPositiveFromMonth1 && (
                  <p className="rounded-lg bg-emerald-100 p-2 font-semibold text-emerald-900">
                    {t('detail.cashPositive')}
                  </p>
                )}
              </div>
            )}
            <p className="text-xs text-gray-500">{t('detail.lenderNote')}</p>
          </section>

          {planned && (
            <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="font-semibold">{t('detail.packTitle')}</h2>
              <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-900">
                ✓ {t('detail.planned')}
              </p>
              <label className="block text-sm">
                <span className="font-medium">{t('detail.vendor')}</span>
                <input
                  className="mt-1 min-h-12 w-full rounded-lg border px-3 text-base"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">{t('detail.quote')}</span>
                <input
                  inputMode="numeric"
                  className="mt-1 min-h-12 w-full rounded-lg border px-3 text-base"
                  value={quote}
                  onChange={(e) => {
                    const n = digits(e.target.value);
                    setQuote(n ? new Intl.NumberFormat('en-IN').format(n) : '');
                  }}
                />
                <span className="text-xs text-gray-600">{t('detail.quoteHelp')}</span>
              </label>
              {!calc && <p className="text-sm text-gray-700">{t('detail.needLoan')}</p>}
            </section>
          )}
        </>
      )}
    </Page>
  );
}
