import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { Button } from '../components/kit/Button';
import { Card } from '../components/kit/Card';
import { Skeleton } from '../components/kit/Skeleton';
import { SourceChip } from '../components/kit/SourceChip';
import { StampBadge } from '../components/kit/StampBadge';
import { CarbonTile } from '../components/CarbonTile';
import { DualAxisChart } from '../components/DualAxisChart';
import { SourceSplitBar } from '../components/SourceSplitBar';
import { ErrorBox, monthLabel, Page, tonnesText } from '../components/ui';
import { useCarbon, useMakeCarbonStatement, type Carbon as CarbonData } from '../lib/carbon';
import { formatDecimal, formatFactor, formatInr } from '../lib/format';

/** D6a Carbon tab: footprint, trend, split by source, method, and what cuts it. */
export default function Carbon() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const q = useCarbon();
  const make = useMakeCarbonStatement();
  const c = q.data;

  return (
    <Page
      tab="carbon"
      action={
        <Button
          disabled={!c || make.isPending}
          data-testid="make-carbon-statement"
          onClick={() =>
            make.mutate(undefined, { onSuccess: (r) => navigate(`/reports/${r.reportId}`) })
          }
        >
          {make.isPending ? t('carbon.making') : t('carbon.make')}
        </Button>
      }
    >
      <h1 className="font-heading text-title font-semibold">{t('carbon.title')}</h1>
      {q.isLoading && (
        <>
          <Skeleton />
          <Skeleton />
        </>
      )}
      {q.isError && <ErrorBox>{t('carbon.loadFailed')}</ErrorBox>}
      {make.isError && <ErrorBox>{t('common.genericError')}</ErrorBox>}
      {c && (
        <>
          <div className="grid gap-3 lg:grid-cols-12 lg:gap-6">
            <Card className="lg:col-span-8">
              <CarbonTile c={c} />
            </Card>
            <MethodCard c={c} className="lg:col-span-4" />
          </div>
          <Card className="space-y-3">
            <h2 className="font-heading text-card-title font-semibold">{t('carbon.trendTitle')}</h2>
            <CarbonTrend c={c} />
          </Card>
          <Card className="space-y-2">
            <h2 className="font-heading text-card-title font-semibold">{t('carbon.bySource')}</h2>
            <SourceSplitBar parts={c.bySource} />
          </Card>
          {c.savedSoFar && <AvoidedCard saved={c.savedSoFar} />}
          {!c.household && (
            <div className="grid gap-3 lg:grid-cols-2 lg:gap-6">
              <CutsCard c={c} />
              <ChargeOnlyCard c={c} />
            </div>
          )}
        </>
      )}
    </Page>
  );
}

export function CarbonTrend({ c }: { c: CarbonData }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  return (
    <DualAxisChart
      ariaLabel={t(c.household ? 'carbon.chartLabelHome' : 'carbon.chartLabel')}
      monthHeader={t('carbon.monthCol')}
      barTitle={t('carbon.barTitle')}
      lineTitle={c.household ? undefined : t('carbon.lineTitle')}
      rows={c.months.map((m) => ({
        key: m.month,
        short: monthLabel(m.month, lang).split(' ')[0]!,
        label: monthLabel(m.month, lang),
        bar: m.totalT,
        line: m.intensity,
      }))}
      barTick={(v) => formatDecimal(v)}
      lineTick={(v) => formatDecimal(v)}
      barValue={(v) => `${formatDecimal(Math.round(v * 10) / 10)} t`}
      lineValue={(v) => formatDecimal(v)}
    />
  );
}

function MethodCard({ c, className = '' }: { c: CarbonData; className?: string }) {
  const { t } = useTranslation();
  const f = c.latestMonth.factor;
  return (
    <Card className={`space-y-2 ${className}`} data-testid="carbon-method">
      <h2 className="font-heading text-card-title font-semibold">{t('carbon.methodTitle')}</h2>
      <ul className="space-y-1 rounded-card bg-paper p-3 font-mono text-small">
        {c.method.lines.map((line) => (
          <li key={line} className="break-words">
            {line}
          </li>
        ))}
      </ul>
      {f && (
        <p className="text-small">
          <SourceChip lineName={[f.source, f.page].filter(Boolean).join(', ')}>
            {t('carbon.factorLine', { version: f.version ?? '-', value: formatFactor(f.value) })}
          </SourceChip>
        </p>
      )}
      <p className="text-small text-ink-muted">{t('carbon.methodNote')}</p>
    </Card>
  );
}

function AvoidedCard({ saved }: { saved: NonNullable<CarbonData['savedSoFar']> }) {
  const { t } = useTranslation();
  const verified = saved.verifiedTco2 > 0;
  return (
    <Card className="space-y-2" data-testid="carbon-avoided-card">
      <h2 className="font-heading text-card-title font-semibold">{t('carbon.avoidedTitle')}</h2>
      {verified ? <StampBadge variant="verified" /> : <StampBadge variant="early" />}
      <p className="num font-heading text-title font-semibold">
        {t('carbon.avoided', { value: tonnesText(verified ? saved.verifiedTco2 : saved.tco2) })}
      </p>
      <p className="text-small">{t('carbon.avoidedMonths', { n: saved.months })}</p>
      <p className="text-small text-ink-muted">{t('savings.methodNote')}</p>
      <Link
        to="/savings"
        className="inline-flex min-h-12 items-center gap-1 font-semibold text-green-700"
      >
        {t('savings.open')}
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </Card>
  );
}

function CutsCard({ c }: { c: CarbonData }) {
  const { t } = useTranslation();
  return (
    <Card className="space-y-2" data-testid="carbon-cuts">
      <h2 className="font-heading text-card-title font-semibold">{t('carbon.cutsTitle')}</h2>
      {c.reducible.length === 0 && <p className="text-ink-muted">{t('carbon.cutsEmpty')}</p>}
      <ul>
        {c.reducible.map((a) => (
          <li key={a.actionCode} className="border-b py-2 last:border-b-0">
            <Link
              to={`/actions/${a.actionCode}`}
              className="inline-flex min-h-12 items-center font-semibold text-green-700 underline underline-offset-4"
            >
              {t(`actions.name.${a.actionCode}`, { defaultValue: a.title })}
            </Link>
            <p className="num text-body font-semibold">
              {t('carbon.co2YearRange', {
                low: tonnesText(a.tPerYearLow),
                high: tonnesText(a.tPerYearHigh),
              })}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ChargeOnlyCard({ c }: { c: CarbonData }) {
  const { t } = useTranslation();
  if (c.chargeOnly.length === 0) return null;
  return (
    <Card className="space-y-2" data-testid="carbon-charge-only">
      <h2 className="font-heading text-card-title font-semibold">{t('carbon.chargeTitle')}</h2>
      <ul>
        {c.chargeOnly.map((a) => (
          <li key={a.actionCode} className="border-b py-2 last:border-b-0">
            <Link
              to={`/actions/${a.actionCode}`}
              className="inline-flex min-h-12 items-center font-semibold text-green-700 underline underline-offset-4"
            >
              {t(`actions.name.${a.actionCode}`, { defaultValue: a.title })}
            </Link>
            <p className="num text-small">
              {a.annualInr != null
                ? `${formatInr(a.annualInr)} ${t('actions.perYearShort')} · ${t('carbon.noCo2Change')}`
                : t('carbon.noCo2Change')}
            </p>
          </li>
        ))}
      </ul>
      <p className="text-small text-ink-muted">{t('carbon.fundingLine')}</p>
    </Card>
  );
}
