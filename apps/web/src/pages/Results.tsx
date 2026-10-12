import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Info } from '@phosphor-icons/react/dist/csr/Info';
import { BottomSheet } from '../components/kit/BottomSheet';
import { BUTTON_CLASS, Button } from '../components/kit/Button';
import { Card } from '../components/kit/Card';
import { RupeeHero } from '../components/kit/RupeeHero';
import { Skeleton } from '../components/kit/Skeleton';
import { SourceChip } from '../components/kit/SourceChip';
import { StampBadge } from '../components/kit/StampBadge';
import { StatusPill } from '../components/kit/StatusPill';
import { ErrorBox, monthLabel, Page } from '../components/ui';
import { api, ApiError, type Explain, type MonthRow } from '../lib/api';
import { formatDecimal, formatNumber } from '../lib/format';
import { useInsights } from './Health';
import { getSession } from '../lib/session';

const INPUT_LABEL = { kwh: 'inputKwh', litres: 'inputLitres', tonnes: 'inputTonnes' } as const;
const INPUT_UNIT = { kwh: 'kWh', litres: 'L', tonnes: 't' } as const;

/** Estimates get the stamp (Doc 05); confirmed factors a plain pill. */
function FactorStatus({ status }: { status: string }) {
  const { t } = useTranslation();
  if (status === 'confirmed') {
    return <StatusPill tone="positive">{t('results.status.confirmed')}</StatusPill>;
  }
  if (status === 'confirmed_replace') {
    return <StatusPill tone="check">{t('results.status.confirmed_replace')}</StatusPill>;
  }
  return <StampBadge variant="estimate" />;
}

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
  const source = `${fromBill}: ${month}`;
  const loading = explain.isLoading || months.isLoading;

  return (
    <Page
      action={
        <Button disabled={!ex} onClick={() => navigate(`/health?month=${ex?.month.slice(0, 7)}`)}>
          {t('results.seeHealth')}
        </Button>
      }
    >
      {loading && (
        <>
          <Skeleton />
          <Skeleton />
        </>
      )}
      {explain.isError && (
        <ErrorBox>
          {explain.error instanceof ApiError && explain.error.status === 404
            ? t('results.notFound')
            : t('results.loadFailed')}
        </ErrorBox>
      )}

      {ex && (
        <>
          <h1 className="font-heading text-title font-semibold">{t('results.title', { month })}</h1>

          <Card>
            {row?.rupees.total != null && (
              <RupeeHero
                value={Math.round(row.rupees.total)}
                label={t('results.bill')}
                countUpKey={`result-${resultId}`}
                source={{ lineName: source, month, quality: 'fromBill' }}
                unitsText={
                  kwh && (
                    <>
                      <SourceChip lineName={source} month={month} quality="fromBill">
                        {formatNumber(kwh.value)}
                      </SourceChip>{' '}
                      {t('common.units')}
                    </>
                  )
                }
                co2Text={
                  row.co2 && (
                    <div className="space-y-1">
                      <p>
                        <SourceChip lineName={t('results.why')}>
                          {formatDecimal(row.co2.scope2TCo2Grid ?? 0)}
                        </SourceChip>{' '}
                        {t('results.scope2')}
                        {' + '}
                        <SourceChip lineName={t('results.why')}>
                          {formatDecimal(row.co2.scope1TCo2eFuels ?? 0)}
                        </SourceChip>{' '}
                        {t('results.scope1')}
                      </p>
                      {row.intensity != null && (
                        <p>
                          <b>{formatDecimal(row.intensity)}</b> {t('results.intensityCo2')}
                        </p>
                      )}
                      {kwh && tonnes && tonnes.value > 0 && (
                        <p>
                          <b>{formatNumber(Math.round(kwh.value / tonnes.value))}</b>{' '}
                          {t('results.intensityKwh')}
                        </p>
                      )}
                    </div>
                  )
                }
              />
            )}
            <Button variant="secondary" className="mt-2" onClick={() => setWhyOpen(true)}>
              <Info size={20} aria-hidden="true" />
              {t('results.why')}
            </Button>
          </Card>

          <BottomSheet
            open={whyOpen}
            title={t('results.whyTitle')}
            onClose={() => setWhyOpen(false)}
          >
            <Why ex={ex} />
          </BottomSheet>

          <Card className="space-y-2">
            <h2 className="font-heading text-card-title font-semibold">
              {t('results.healthTitle')}
            </h2>
            {health && (
              <>
                <div data-testid="at-stake">
                  <RupeeHero
                    size="mini"
                    value={Math.round(health.atStake.inrPerMonth)}
                    source={{ lineName: t('results.healthSource') }}
                    unitsText={t('health.perMonth')}
                  />
                </div>
                {health.atStake.pendingCodes.includes('peak_use') && (
                  <p className="text-ink-muted">{t('results.peakPending')}</p>
                )}
                <p className="text-ink-muted">
                  {t('results.healthCount', { count: health.findings.length })}
                </p>
              </>
            )}
            {!health && !insights.isError && <Skeleton />}
          </Card>

          <Link to="/home" className={`${BUTTON_CLASS.secondary} w-full`}>
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
    <div className="space-y-4 text-small">
      <div>
        <h3 className="mb-1 text-body font-semibold">{t('results.factors')}</h3>
        <ul className="space-y-3">
          {ex.factors.map((f) => (
            <li key={f.id} className="space-y-1 rounded-card bg-paper p-3">
              <p className="font-semibold">
                {t('results.factorLine', {
                  value: formatDecimal(f.value),
                  unit: f.unit,
                  version: f.version,
                })}
              </p>
              <FactorStatus status={f.status} />
              <p className="text-ink-muted">{t('results.source', { source: f.source })}</p>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-1 text-body font-semibold">{t('results.inputs')}</h3>
        <ul className="space-y-1">
          {ex.inputs.map((i, n) => (
            <li
              key={`${i.kind}-${n}`}
              className="flex flex-wrap items-center justify-between gap-2"
            >
              <span className="num">
                {t(`results.${INPUT_LABEL[i.kind]}`)}: {formatNumber(i.value)} {INPUT_UNIT[i.kind]}
              </span>
              <StatusPill>{known(i.qualityTag, 'quality')}</StatusPill>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-1 text-body font-semibold">{t('results.formula')}</h3>
        <ul className="space-y-1 text-ink-muted">
          <li>{ex.formula.scope2}</li>
          <li>{ex.formula.scope1}</li>
          <li>{ex.formula.intensity}</li>
        </ul>
        <p className="mt-1 text-ink-muted">
          {t('results.formulaVersion', { version: ex.formulaVersion })}
        </p>
      </div>
    </div>
  );
}
