import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { ChartLineUp } from '@phosphor-icons/react/dist/csr/ChartLineUp';
import { BottomSheet } from '../components/kit/BottomSheet';
import { BUTTON_CLASS } from '../components/kit/Button';
import { Card } from '../components/kit/Card';
import { EmptyState } from '../components/kit/EmptyState';
import { prefersReducedMotion } from '../components/kit/motion';
import { CarbonHero } from '../components/kit/CarbonHero';
import { RupeeHero } from '../components/kit/RupeeHero';
import { Skeleton } from '../components/kit/Skeleton';
import { StampBadge } from '../components/kit/StampBadge';
import { SavingsChart } from '../components/SavingsChart';
import { ErrorBox, monthLabel, Page } from '../components/ui';
import { formatDecimal, formatInr, formatNumber } from '../lib/format';
import { nextText, useProgress } from '../lib/progress';
import { useSavings, type Savings as SavingsData } from '../lib/savings';

const STAMP_KEY = 'ecoproof.savings.stamped';

/** The stamp presses once per browser session; storage that throws just means no animation. */
function useStampOnce(active: boolean): boolean {
  const [press, setPress] = useState(false);
  useEffect(() => {
    if (!active) return;
    try {
      if (sessionStorage.getItem(STAMP_KEY)) return;
      sessionStorage.setItem(STAMP_KEY, '1');
    } catch {
      return;
    }
    if (!prefersReducedMotion()) setPress(true);
  }, [active]);
  return press;
}

/** "Rs X saved so far", the months after the action against the baseline, and how it is measured. */
export default function Savings() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const q = useSavings();
  const progress = useProgress();
  const [how, setHow] = useState(false);
  const s = q.data;
  const press = useStampOnce(!!s && s.months.some((m) => m.status === 'verified'));
  const next = progress.data?.next;

  return (
    <Page
      tab="home"
      action={
        next && (
          <Link to={next.href} className={BUTTON_CLASS.primary} data-testid="primary-next">
            {nextText(next, t)}
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
        )
      }
    >
      <h1 className="font-heading text-title font-semibold">{t('savings.title')}</h1>
      {q.isLoading && (
        <>
          <Skeleton />
          <Skeleton />
        </>
      )}
      {q.isError && <ErrorBox>{t('savings.loadFailed')}</ErrorBox>}
      {s && s.months.length === 0 && (
        <EmptyState
          icon={ChartLineUp}
          title={t('savings.emptyTitle')}
          body={t(`savings.reason.${s.reasonCode ?? 'no_savings_yet'}`)}
        />
      )}
      {s && s.months.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:gap-6" data-testid="savings-twin">
            <Card>
              <RupeeHero
                value={Math.round(s.totals.savedInr)}
                label={t('savings.heroLabel')}
                countUpKey="savings-hero"
                unitsText={<Units s={s} />}
              />
            </Card>
            <Card className="space-y-2">
              <CarbonHero
                tonnes={s.totals.savedTco2}
                unit={t('carbon.unit')}
                label={t('savings.co2Label')}
                splitText={t('savings.unitsLine', {
                  kwh: formatNumber(Math.round(s.totals.savedKwh)),
                })}
              />
              {s.months.some((m) => m.status === 'verified') && <StampBadge variant="verified" />}
            </Card>
          </div>
          <Card className="space-y-3">
            <h2 className="font-heading text-card-title font-semibold">
              {t('savings.chartTitle')}
            </h2>
            <SavingsChart
              months={s.months}
              lang={lang}
              summary={`${formatInr(Math.round(s.totals.savedInr))} · ${t('savings.co2Total', {
                value: formatDecimal(s.totals.savedTco2),
              })}`}
            />
            <p className="text-small text-ink-muted" data-testid="method-note">
              {t('savings.methodNote')}
            </p>
            <button
              type="button"
              onClick={() => setHow(true)}
              className={`${BUTTON_CLASS.secondary} w-full`}
            >
              {t('savings.how')}
            </button>
          </Card>
          <section className="space-y-2">
            <h2 className="font-heading text-card-title font-semibold">{t('savings.byMonth')}</h2>
            <ul className="grid gap-2 lg:grid-cols-3 lg:gap-4">
              {s.months.map((m) => (
                <li key={m.month}>
                  <Card className="space-y-1" data-testid={`month-${m.month}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-semibold">{monthLabel(`${m.month}-01`, lang)}</p>
                      <StampBadge
                        variant={m.status === 'verified' ? 'verified' : 'early'}
                        press={press && m.status === 'verified'}
                      />
                    </div>
                    <p className="num text-body font-semibold">
                      {formatInr(Math.round(m.savedInr))}
                    </p>
                    <p className="num text-small text-ink-muted">
                      {t('savings.unitsLine', { kwh: formatNumber(Math.round(m.savedKwh)) })}
                      {' · '}
                      {t('savings.co2Line', { value: formatDecimal(m.savedTco2) })}
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
      {s?.baseline && (
        <BottomSheet open={how} title={t('savings.how')} onClose={() => setHow(false)}>
          <HowWeMeasure baseline={s.baseline} />
        </BottomSheet>
      )}
    </Page>
  );
}

function Units({ s }: { s: SavingsData }) {
  const { t } = useTranslation();
  return (
    <>
      {s.thisMonth && (
        <p className="font-semibold" data-testid="this-month">
          {t('savings.thisMonth', { inr: formatInr(Math.round(s.thisMonth.savedInr)) })}
        </p>
      )}
    </>
  );
}

function HowWeMeasure({ baseline }: { baseline: NonNullable<SavingsData['baseline']> }) {
  const { t } = useTranslation();
  const rows: Array<[string, string]> = [
    [
      t('savings.m.method'),
      t(`savings.methodName.${baseline.method}`, { defaultValue: baseline.method }),
    ],
    [
      t('savings.m.cvrmse'),
      baseline.cvRmsePct == null ? '-' : `${formatDecimal(baseline.cvRmsePct)}%`,
    ],
    [t('savings.m.nmbe'), baseline.nmbePct == null ? '-' : `${formatDecimal(baseline.nmbePct)}%`],
    [t('savings.m.result'), t(baseline.passes ? 'savings.m.pass' : 'savings.m.fail')],
    [t('savings.m.months'), String(baseline.monthsUsed)],
  ];
  return (
    <div className="space-y-3">
      <p className="text-body">{t('savings.m.intro')}</p>
      <dl className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b py-1">
            <dt className="text-ink-muted">{k}</dt>
            <dd className="num font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="rounded-card bg-paper p-3 text-small">
        <span className="font-semibold">{t('savings.m.formula')}</span>
        <br />
        {t('savings.m.formulaText', {
          a: formatNumber(Math.round(baseline.a)),
          b: formatDecimal(baseline.b),
        })}
      </p>
      <p className="text-small text-ink-muted">{t('savings.methodNote')}</p>
    </div>
  );
}
