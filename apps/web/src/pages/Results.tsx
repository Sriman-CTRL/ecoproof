import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ErrorBox, monthLabel, Page, PRIMARY, Rupees, SourceNumber } from '../components/ui';
import { api, ApiError, type Explain, type MonthRow } from '../lib/api';
import { formatDecimal, formatNumber } from '../lib/format';
import { useInsights } from './Health';
import { getSession } from '../lib/session';

const BADGE: Record<string, string> = {
  confirmed: 'bg-emerald-100 text-emerald-900',
  confirmed_replace: 'bg-amber-100 text-amber-900',
  estimate_only: 'bg-amber-100 text-amber-900',
  verify: 'bg-amber-100 text-amber-900',
};
const INPUT_LABEL = { kwh: 'inputKwh', litres: 'inputLitres', tonnes: 'inputTonnes' } as const;
const INPUT_UNIT = { kwh: 'kWh', litres: 'L', tonnes: 't' } as const;

export default function Results() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { resultId = '' } = useParams();
  const siteId = getSession()?.siteId ?? '';
  const [whyOpen, setWhyOpen] = useState(false);
  const lang = i18n.resolvedLanguage ?? 'en';

  const explain = useQuery({
    queryKey: ['explain', resultId],
    queryFn: () => api<Explain>(`/results/${resultId}/explain`),
  });
  const months = useQuery({
    queryKey: ['months', siteId],
    queryFn: () => api<MonthRow[]>(`/sites/${siteId}/months`),
  });
  const insights = useInsights(explain.data?.month ?? null, null, { waitForMonth: true });
  // Only this bill's month: never another month's cached answer.
  const health = insights.data?.month === explain.data?.month ? insights.data : undefined;
  const row = months.data?.find((m) => m.resultId === resultId);
  const ex = explain.data;
  const kwh = ex?.inputs.find((i) => i.kind === 'kwh');
  const tonnes = ex?.inputs.find((i) => i.kind === 'tonnes');
  const fromBill = t('common.fromBill');
  const month = ex ? monthLabel(ex.month, lang) : '';

  return (
    <Page
      action={
        <button
          type="button"
          className={PRIMARY}
          disabled={!ex}
          onClick={() => navigate(`/health?month=${ex?.month.slice(0, 7)}`)}
        >
          {t('results.seeHealth')}
        </button>
      }
    >
      {(explain.isLoading || months.isLoading) && <p>{t('common.loading')}</p>}
      {explain.isError && (
        <ErrorBox>
          {explain.error instanceof ApiError && explain.error.status === 404
            ? t('results.notFound')
            : t('results.loadFailed')}
        </ErrorBox>
      )}

      {ex && (
        <>
          <h1 className="text-xl font-bold">{t('results.title', { month })}</h1>

          <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
            {row?.rupees.total != null && (
              <div>
                <p className="text-3xl font-bold">
                  <SourceNumber source={`${fromBill}: ${month}`}>
                    <Rupees value={row.rupees.total} />
                  </SourceNumber>
                </p>
                <p className="text-xs text-gray-500">{t('results.bill')}</p>
              </div>
            )}
            {kwh && (
              <p className="text-lg">
                <SourceNumber source={`${fromBill}: ${month}`}>
                  {formatNumber(kwh.value)}
                </SourceNumber>{' '}
                <span className="text-gray-600">{t('common.units')}</span>
              </p>
            )}
            {row?.co2 && (
              <p className="text-lg">
                <SourceNumber source={t('results.why')}>
                  {formatDecimal(row.co2.scope2TCo2Grid ?? 0)}
                </SourceNumber>{' '}
                <span className="text-gray-600">{t('results.scope2')}</span>
                {' + '}
                <SourceNumber source={t('results.why')}>
                  {formatDecimal(row.co2.scope1TCo2eFuels ?? 0)}
                </SourceNumber>{' '}
                <span className="text-gray-600">{t('results.scope1')}</span>
              </p>
            )}
            {row?.intensity != null && (
              <p>
                <span className="text-lg font-semibold">{formatDecimal(row.intensity)}</span>{' '}
                <span className="text-gray-600">{t('results.intensityCo2')}</span>
              </p>
            )}
            {kwh && tonnes && tonnes.value > 0 && (
              <p>
                <span className="text-lg font-semibold">
                  {formatNumber(Math.round(kwh.value / tonnes.value))}
                </span>{' '}
                <span className="text-gray-600">{t('results.intensityKwh')}</span>
              </p>
            )}
          </section>

          <section className="rounded-2xl bg-white shadow-sm">
            <button
              type="button"
              className="flex min-h-12 w-full items-center justify-between p-4 text-left font-semibold"
              aria-expanded={whyOpen}
              onClick={() => setWhyOpen((o) => !o)}
            >
              <span>ⓘ {t('results.why')}</span>
              <span aria-hidden>{whyOpen ? '−' : '+'}</span>
            </button>
            {whyOpen && <Why ex={ex} />}
          </section>

          <section className="space-y-1 rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="font-semibold">{t('results.healthTitle')}</h2>
            {health && (
              <>
                <p className="text-3xl font-bold" data-testid="at-stake">
                  <SourceNumber source={t('results.healthSource')}>
                    <Rupees value={health.atStake.inrPerMonth} />
                  </SourceNumber>{' '}
                  <span className="text-base font-normal text-gray-600">
                    {t('health.perMonth')}
                  </span>
                </p>
                {health.atStake.pendingCodes.includes('peak_use') && (
                  <p className="text-gray-700">{t('results.peakPending')}</p>
                )}
                <p className="text-gray-700">
                  {t('results.healthCount', { count: health.findings.length })}
                </p>
              </>
            )}
            {!health && !insights.isError && <p>{t('common.loading')}</p>}
          </section>

          <Link to="/home" className="flex min-h-12 items-center justify-center underline">
            {t('results.backHome')}
          </Link>
        </>
      )}
    </Page>
  );
}

function Why({ ex }: { ex: Explain }) {
  const { t } = useTranslation();
  const known = (key: string, map: string) =>
    t(`results.${map}.${key}`, { defaultValue: t('results.status.estimate_only') });
  return (
    <div className="space-y-4 border-t p-4 text-sm">
      <div>
        <h3 className="mb-1 font-semibold">{t('results.factors')}</h3>
        <ul className="space-y-3">
          {ex.factors.map((f) => (
            <li key={f.id} className="rounded-lg bg-gray-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {t('results.factorLine', {
                    value: formatDecimal(f.value),
                    unit: f.unit,
                    version: f.version,
                  })}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[f.status] ?? BADGE.verify}`}
                >
                  {known(f.status, 'status')}
                </span>
              </div>
              <p className="mt-1 text-gray-600">{t('results.source', { source: f.source })}</p>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-1 font-semibold">{t('results.inputs')}</h3>
        <ul className="space-y-1">
          {ex.inputs.map((i, n) => (
            <li key={`${i.kind}-${n}`} className="flex flex-wrap justify-between gap-2">
              <span>
                {t(`results.${INPUT_LABEL[i.kind]}`)}: {formatNumber(i.value)} {INPUT_UNIT[i.kind]}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                {known(i.qualityTag, 'quality')}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-1 font-semibold">{t('results.formula')}</h3>
        <ul className="space-y-1 text-gray-700">
          <li>{ex.formula.scope2}</li>
          <li>{ex.formula.scope1}</li>
          <li>{ex.formula.intensity}</li>
        </ul>
        <p className="mt-1 text-xs text-gray-500">
          {t('results.formulaVersion', { version: ex.formulaVersion })}
        </p>
      </div>
    </div>
  );
}
