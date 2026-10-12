import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { Receipt } from '@phosphor-icons/react/dist/csr/Receipt';
import { BUTTON_CLASS } from '../components/kit/Button';
import { Card, CARD_CLASS } from '../components/kit/Card';
import { EmptyState } from '../components/kit/EmptyState';
import { HeadroomMeter } from '../components/kit/HeadroomMeter';
import { ProgressPath } from '../components/kit/ProgressPath';
import { RupeeHero } from '../components/kit/RupeeHero';
import { Skeleton } from '../components/kit/Skeleton';
import { SourceChip } from '../components/kit/SourceChip';
import { YearStrip } from '../components/kit/YearStrip';
import { MonthLedger } from '../components/MonthLedger';
import { ErrorBox, monthLabel, Page, SwitchSample, yearMonths } from '../components/ui';
import { api, type MonthRow } from '../lib/api';
import { useInsights } from './Health';
import { formatDecimal, formatInr, formatNumber } from '../lib/format';
import { nextText, pathText, useProgress, type Progress } from '../lib/progress';
import { useSavings } from '../lib/savings';
import { getSession } from '../lib/session';

interface LatestDoc {
  id: string;
  status: string;
}

/** "12.72 t CO2 more from grid electricity", plus the fuel part only when fuel CO2e changed. */
export function co2Parts(
  change: { tCo2Grid: number | null; tCo2eFuels: number | null },
  t: TFunction,
): string {
  const parts: string[] = [];
  const part = (key: string, v: number) =>
    t(key, {
      value: formatDecimal(Math.abs(v)),
      direction: t(v >= 0 ? 'home.more' : 'home.less'),
    });
  if (change.tCo2Grid != null) parts.push(part('home.co2Grid', change.tCo2Grid));
  if (change.tCo2eFuels != null && Math.abs(change.tCo2eFuels) >= 0.005) {
    parts.push(part('home.co2Fuels', change.tCo2eFuels));
  }
  return parts.length ? `, ${parts.join(', ')}` : '';
}

export default function Home() {
  const { t, i18n } = useTranslation();
  const session = getSession();
  const siteId = session?.siteId ?? '';
  const months = useQuery({
    queryKey: ['months', siteId],
    queryFn: () => api<MonthRow[]>(`/sites/${siteId}/months`),
  });
  const savings = useSavings();
  const latestDoc = useQuery({
    queryKey: ['latest-doc', siteId],
    queryFn: () => api<LatestDoc | null>(`/sites/${siteId}/documents/latest`),
  });

  const list = months.data ?? [];
  const top = list[0];
  const topMonth = top?.month ?? null;
  const insights = useInsights(topMonth, null, { waitForMonth: true });
  // One "next" for the whole screen: the path's next step is also the primary button (plan 4).
  const progress = useProgress();
  const p = progress.data;
  const card = insights.data?.insightCard;
  const lang = i18n.resolvedLanguage ?? 'en';
  const resume = latestDoc.data;
  const resumeTo =
    resume?.status === 'extracted'
      ? `/bills/${resume.id}/confirm`
      : resume && ['received', 'needs_manual'].includes(resume.status)
        ? `/bills/new?doc=${resume.id}`
        : null;

  const month = top ? monthLabel(top.month, lang) : '';
  const source = t('home.sourceBill', { month });
  // Demo A: the money at stake straight from the API. Demo B and the fallback: the latest bill.
  // A site with savings leads with "Rs saved this month / total so far" from /savings.
  const atStake = insights.data?.atStake.inrPerMonth ?? 0;
  // Demo A leads with the money at stake: wait for it rather than flash the bill total first.
  const waitingForStake =
    (session?.demo === 'A' && insights.isPending && !insights.isError) ||
    (savings.isPending && !savings.isError);
  const sv = savings.data;
  const hasSavings = !!sv && sv.months.length > 0 && sv.thisMonth != null;
  const showAtStake = !hasSavings && session?.demo === 'A' && atStake > 0;
  const co2 = top?.co2
    ? t('results.co2Line', {
        grid: formatDecimal(top.co2.scope2TCo2Grid ?? 0),
        fuels: formatDecimal(top.co2.scope1TCo2eFuels ?? 0),
      })
    : undefined;

  const ritual = p?.ritual;
  const ritualDone =
    !!ritual &&
    ritual.billReceived &&
    ritual.valuesConfirmed &&
    ritual.billChecked &&
    ritual.actionChosen;

  return (
    <Page
      tab="home"
      action={
        p ? (
          <Link to={p.next.href} className={BUTTON_CLASS.primary} data-testid="primary-next">
            {nextText(p.next, t)}
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
        ) : progress.isError ? (
          <Link to="/bills/new" className={BUTTON_CLASS.primary}>
            {t('home.addBill')}
          </Link>
        ) : undefined
      }
    >
      {months.isError && <ErrorBox>{t('home.loadFailed')}</ErrorBox>}
      {months.isLoading && <Skeleton />}

      {resumeTo && (
        <Link
          to={resumeTo}
          className="flex min-h-12 items-center gap-2 rounded-card border border-copper-700 bg-copper-50 p-3 font-semibold text-copper-800"
        >
          <ArrowRight size={20} aria-hidden="true" />
          {t('home.resume')}
        </Link>
      )}

      {top && waitingForStake && <Skeleton />}
      {top && !waitingForStake && (
        <Card>
          <h1 className="sr-only">{t('home.latestBill', { month })}</h1>
          {hasSavings ? (
            <Link to="/savings" className="block" data-testid="savings-hero">
              <RupeeHero
                value={Math.round(sv.thisMonth!.savedInr)}
                label={t('home.heroSaved')}
                countUpKey="home-hero"
                unitsText={t('home.savedTotal', { inr: formatInr(Math.round(sv.totals.savedInr)) })}
                co2Text={t('savings.co2Line', { value: formatDecimal(sv.totals.savedTco2) })}
              />
              <span className="mt-2 flex items-center gap-1 text-small font-semibold text-green-700">
                {t('savings.open')}
                <ArrowRight size={16} aria-hidden="true" />
              </span>
            </Link>
          ) : showAtStake ? (
            <RupeeHero
              value={Math.round(atStake)}
              label={t('home.heroAtStake')}
              countUpKey="home-hero"
              source={{ lineName: t('results.healthSource'), month, quality: 'fromBill' }}
              unitsText={t('health.perMonth')}
            />
          ) : top.rupees.total != null ? (
            <RupeeHero
              value={Math.round(top.rupees.total)}
              label={t('home.heroBill')}
              countUpKey="home-hero"
              source={{ lineName: source, month, quality: 'fromBill' }}
              unitsText={
                top.kwh != null ? (
                  <SourceChip lineName={source} month={month} quality="fromBill">
                    {t('home.unitsLine', { units: formatNumber(top.kwh) })}
                  </SourceChip>
                ) : undefined
              }
              co2Text={co2}
            />
          ) : null}
        </Card>
      )}

      {progress.isLoading && <Skeleton />}
      {p && (
        <Link to="/progress" className={`${CARD_CLASS} block`} data-testid="progress-path">
          <h2 className="sr-only">{t('progress.title')}</h2>
          <ProgressPath currentStage={p.stage} nextStep={pathText(p.next, t)} />
          <span className="mt-2 flex items-center gap-1 text-small font-semibold text-green-700">
            {t('progress.open')}
            <ArrowRight size={16} aria-hidden="true" />
          </span>
        </Link>
      )}
      {p && p.headroom.foundInrPerMonth > 0 && (
        <Card>
          <h2 className="sr-only">{t('home.headroomTitle')}</h2>
          <HeadroomMeter
            found={p.headroom.foundInrPerMonth}
            started={p.headroom.startedInrPerMonth}
          />
        </Card>
      )}

      {months.isLoading || (top && insights.isLoading) ? (
        <Skeleton />
      ) : (
        card?.change &&
        card.largestDriver && (
          <p
            className="rounded-card border bg-surface p-4 shadow-card"
            data-testid="insight-sentence"
          >
            {t('home.insight', {
              direction: t(card.change.inr! >= 0 ? 'home.higher' : 'home.lower'),
              inr: formatInr(Math.abs(Math.round(card.change.inr ?? 0))),
              kwh: formatNumber(Math.abs(Math.round(card.change.kwh ?? 0))),
              co2: co2Parts(card.change, t),
              driver: t(`home.driver.${card.largestDriver}`),
            })}
          </p>
        )
      )}

      {ritual?.month && <RitualCard ritual={ritual} done={ritualDone} lang={lang} />}

      {list.length > 0 && (
        <Card>
          <YearStrip
            months={yearMonths(
              list,
              lang,
              ritual?.month ? { month: ritual.month, done: ritualDone } : null,
            )}
          />
        </Card>
      )}

      {months.isSuccess && list.length === 0 && (
        <EmptyState
          icon={Receipt}
          title={t('bills.emptyTitle')}
          body={t('home.empty')}
          action={
            <Link to="/bills/new" className={BUTTON_CLASS.secondary}>
              {t('home.addBill')}
            </Link>
          }
        />
      )}

      {list.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-heading text-card-title font-semibold">{t('home.recent')}</h2>
          <MonthLedger rows={list.slice(0, 3)} />
          <Link to="/bills" className={`${BUTTON_CLASS.secondary} w-full`}>
            {t('home.seeAllBills')}
          </Link>
        </section>
      )}

      <SwitchSample />
    </Page>
  );
}

const RITUAL_STEPS = ['billReceived', 'valuesConfirmed', 'billChecked', 'actionChosen'] as const;

/** "This month": the 4-step monthly ritual (plan 6.2). Ticks only go up within a month. */
function RitualCard({
  ritual,
  done,
  lang,
}: {
  ritual: Progress['ritual'];
  done: boolean;
  lang: string;
}) {
  const { t } = useTranslation();
  const month = monthLabel(`${ritual.month}-01`, lang);
  return (
    <Card data-testid="ritual" className="space-y-2">
      <h2 className="font-heading text-card-title font-semibold">
        {t('home.ritual.title', { month })}
      </h2>
      <ul className="space-y-1">
        {RITUAL_STEPS.map((k) => (
          <li key={k} className="flex min-h-8 items-center gap-2">
            <span
              aria-hidden="true"
              className={`flex size-6 shrink-0 items-center justify-center rounded-chip border-2 ${
                ritual[k] ? 'border-green-700 bg-green-700 text-white' : 'border-line bg-surface'
              }`}
            >
              {ritual[k] && <Check size={14} weight="bold" />}
            </span>
            <span className={ritual[k] ? 'text-ink' : 'text-ink-muted'}>
              {t(`home.ritual.${k}`)}
              <span className="sr-only">
                {' '}
                ({t(ritual[k] ? 'home.ritual.done' : 'home.ritual.notYet')})
              </span>
            </span>
          </li>
        ))}
      </ul>
      {done && (
        <p className="text-small font-semibold text-green-700">
          {t('home.ritual.allDone', { month })}
        </p>
      )}
    </Card>
  );
}
