import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionPeerCases } from '../components/MitraBits';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { Button } from '../components/kit/Button';
import { Card } from '../components/kit/Card';
import { Skeleton } from '../components/kit/Skeleton';
import { SourceChip } from '../components/kit/SourceChip';
import { LoanResult, LoanTermInputs, useLoanTerms } from '../components/LoanMaths';
import { actionCo2Text, ErrorBox, Page, Rupees } from '../components/ui';
import { api, postJson, type ActionsResponse, type LoanPackCreated } from '../lib/api';
import { formatInr, formatNumber } from '../lib/format';
import { getSession } from '../lib/session';
import { useInrInput } from '../lib/useInrInput';
import {
  ActionCost,
  ActionStatus,
  actionTitle,
  CostBadge,
  paybackText,
  savingPendingText,
} from './Actions';

export default function ActionDetail() {
  const { t } = useTranslation();
  const { code = '' } = useParams();
  const [params] = useSearchParams();
  const month = params.get('month');
  const siteId = getSession()?.siteId ?? '';
  const qc = useQueryClient();
  const navigate = useNavigate();
  // Keyed by action code and dropped as soon as nobody uses it: a saving cached for another
  // action or an older bill is never shown while this one loads.
  const q = useQuery({
    queryKey: ['actions', siteId, 'detail', code, month],
    gcTime: 0,
    queryFn: async () => {
      const qs = new URLSearchParams({ all: '1' });
      if (month) qs.set('month', month.slice(0, 7));
      const r = await api<ActionsResponse>(`/sites/${siteId}/actions?${qs}`);
      // Zero-cost bill fixes (bill-derived findings) free up money that can cover an EMI gap.
      const billFixes = r.actions
        .filter((x) => x.finding != null && x.code !== code)
        .reduce((t, x) => t + (x.inrPerMonthLow ?? 0), 0);
      return { action: r.actions.find((x) => x.code === code) ?? null, billFixes };
    },
  });
  const a = q.data?.action ?? undefined;

  const [vendor, setVendor] = useState('');
  const quote = useInrInput();
  const plan = useMutation({
    mutationFn: () => postJson(`/sites/${siteId}/actions/${code}/plan`, { status: 'planned' }),
    onSuccess: () =>
      void Promise.all(['actions', 'progress'].map((k) => qc.invalidateQueries({ queryKey: [k] }))),
  });

  const terms = useLoanTerms({ loan: null, ratePct: 8, months: 60 });
  const { principal, annualRate, tenure } = terms;
  const calc = terms.emi != null ? { emi: terms.emi } : null;
  const planned = plan.isSuccess || (a != null && a.status !== 'suggested');
  const quoteInr = quote.value;
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

  const inputClass = 'mt-1 min-h-12 w-full rounded-button border bg-surface px-3 text-body';
  const labelClass = 'block text-small';
  const range =
    a?.inrPerMonthLow != null &&
    a.inrPerMonthHigh != null &&
    a.inrPerMonthHigh !== a.inrPerMonthLow ? (
      <>
        {formatInr(Math.round(a.inrPerMonthLow))} {t('detail.to')}{' '}
        {formatInr(Math.round(a.inrPerMonthHigh))}
      </>
    ) : a?.inrPerMonthLow != null ? (
      <>{formatInr(Math.round(a.inrPerMonthLow))}</>
    ) : null;

  return (
    <Page
      tab="plan"
      action={
        planned ? (
          <Button
            disabled={!a || !calc || a.inrPerMonthLow == null || makePack.isPending}
            onClick={() => makePack.mutate()}
          >
            {makePack.isPending ? t('detail.making') : t('detail.makePack')}
          </Button>
        ) : (
          <Button disabled={!a || plan.isPending} onClick={() => plan.mutate()}>
            {t('detail.plan')}
          </Button>
        )
      }
    >
      {q.isLoading && (
        <>
          <Skeleton />
          <Skeleton />
        </>
      )}
      {q.isError && <ErrorBox>{t('actions.loadFailed')}</ErrorBox>}
      {(plan.isError || makePack.isError) && <ErrorBox>{t('common.genericError')}</ErrorBox>}
      {q.isSuccess && !a && <ErrorBox>{t('detail.notFound')}</ErrorBox>}
      {a && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-title font-semibold">{actionTitle(a, t)}</h1>
            <ActionStatus status={planned && a.status === 'suggested' ? 'planned' : a.status} />
            <CostBadge a={a} />
          </div>
          <div className="grid gap-3 lg:grid-cols-12 lg:items-start lg:gap-6">
            <div className="space-y-3 lg:col-span-7 lg:space-y-6">
              <Card className="space-y-2">
                {range ? (
                  <>
                    <p className="text-small text-ink-muted">{t('detail.range')}</p>
                    <p className="num font-heading text-title font-semibold">
                      <SourceChip lineName={a.source}>{range}</SourceChip>{' '}
                      <span className="text-body font-normal text-ink-muted">
                        {t('health.perMonth')}
                      </span>
                    </p>
                    {a.annualInrMid != null && (
                      <p className="num text-ink-muted">
                        <Rupees value={a.annualInrMid} /> {t('actions.perYear')}
                      </p>
                    )}
                    {a.kwhPerYearLow != null && a.kwhPerYearHigh != null && (
                      <p className="num text-ink-muted">
                        {t('actions.kwhRange', {
                          low: formatNumber(Math.round(a.kwhPerYearLow)),
                          high: formatNumber(Math.round(a.kwhPerYearHigh)),
                        })}
                      </p>
                    )}
                    {actionCo2Text(a, t) && (
                      <p
                        className="num font-heading text-title font-semibold text-green-700"
                        data-testid="detail-co2"
                      >
                        {actionCo2Text(a, t)}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="font-semibold">{savingPendingText(a, t)}</p>
                )}
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                  <dt className="text-ink-muted">{t('actions.cost')}</dt>
                  <dd className="num">
                    <ActionCost a={a} />
                  </dd>
                  <dt className="text-ink-muted">{t('actions.payback')}</dt>
                  <dd className="num">{paybackText(a, t)}</dd>
                </dl>
                {a.co2Note === 'bill_charge_only' && (
                  <p className="text-small text-ink-muted">{t('health.billChargeNote')}</p>
                )}
              </Card>

              {planned && (
                <Card className="space-y-3">
                  <h2 className="font-heading text-card-title font-semibold">
                    {t('detail.packTitle')}
                  </h2>
                  <p className="flex items-center gap-2 rounded-card bg-green-50 p-2 text-small font-semibold text-green-700">
                    <CheckCircle size={20} weight="fill" aria-hidden="true" />
                    {t('detail.planned')}
                  </p>
                  <label className={labelClass}>
                    <span className="font-semibold">{t('detail.vendor')}</span>
                    <input
                      className={inputClass}
                      value={vendor}
                      onChange={(e) => setVendor(e.target.value)}
                    />
                  </label>
                  <label className={labelClass}>
                    <span className="font-semibold">{t('detail.quote')}</span>
                    <input className={`${inputClass} num`} {...quote.inputProps} />
                    <span className="text-small text-ink-muted">{t('detail.quoteHelp')}</span>
                  </label>
                  {!calc && <p className="text-small text-ink-muted">{t('detail.needLoan')}</p>}
                </Card>
              )}
            </div>
            <div className="space-y-3 lg:col-span-5">
              <Card className="space-y-3">
                <h2 className="font-heading text-card-title font-semibold">
                  {t('detail.emiTitle')}
                </h2>
                <LoanTermInputs
                  terms={terms}
                  className={inputClass}
                  labels={{
                    loan: t('detail.loan'),
                    rate: t('detail.rate'),
                    months: t('detail.tenure'),
                    rateHelp: t('detail.rateHelp'),
                  }}
                />
                {calc && a.inrPerMonthLow != null && (
                  <div className="border-t pt-3" data-testid="emi-panel">
                    <LoanResult
                      emi={calc.emi}
                      savingLow={a.inrPerMonthLow}
                      savingHigh={a.inrPerMonthHigh}
                      co2={a.co2}
                      billFixesInr={q.data?.billFixes ?? null}
                    />
                  </div>
                )}
                <p className="text-small text-ink-muted">{t('detail.lenderNote')}</p>
              </Card>
              <ActionPeerCases actionCode={code} />
            </div>
          </div>
        </>
      )}
    </Page>
  );
}
