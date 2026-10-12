import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { Receipt } from '@phosphor-icons/react/dist/csr/Receipt';
import { BUTTON_CLASS } from '../components/kit/Button';
import { Card } from '../components/kit/Card';
import { EmptyState } from '../components/kit/EmptyState';
import { RupeeHero } from '../components/kit/RupeeHero';
import { Skeleton } from '../components/kit/Skeleton';
import { SourceChip } from '../components/kit/SourceChip';
import { YearStrip } from '../components/kit/YearStrip';
import { MonthLedger } from '../components/MonthLedger';
import { ErrorBox, monthLabel, Page, SwitchSample, yearMonths } from '../components/ui';
import { api, type MonthRow } from '../lib/api';
import { actionTitle, useActions } from './Actions';
import { useInsights } from './Health';
import { formatDecimal, formatInr, formatNumber } from '../lib/format';
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
  const latestDoc = useQuery({
    queryKey: ['latest-doc', siteId],
    queryFn: () => api<LatestDoc | null>(`/sites/${siteId}/documents/latest`),
  });

  const list = months.data ?? [];
  const top = list[0];
  const topMonth = top?.month ?? null;
  const insights = useInsights(topMonth, null, { waitForMonth: true });
  const actions = useActions(topMonth, true, topMonth != null);
  // The API's order is the only order (Doc 02 ACT-1): its #1 is the top action.
  const next = actions.data?.actions[0];
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
  // "Rs saved this month / total so far" has no endpoint yet (docs/OPEN_ITEMS.md, UI).
  const atStake = insights.data?.atStake.inrPerMonth ?? 0;
  // Demo A leads with the money at stake: wait for it rather than flash the bill total first.
  const waitingForStake = session?.demo === 'A' && insights.isPending && !insights.isError;
  const showAtStake = session?.demo === 'A' && atStake > 0;
  const co2 = top?.co2
    ? t('results.co2Line', {
        grid: formatDecimal(top.co2.scope2TCo2Grid ?? 0),
        fuels: formatDecimal(top.co2.scope1TCo2eFuels ?? 0),
      })
    : undefined;

  const nextLink = next ? `/actions/${next.code}?month=${topMonth?.slice(0, 7)}` : null;

  return (
    <Page
      tab="home"
      action={
        nextLink && next ? (
          <Link to={nextLink} className={BUTTON_CLASS.primary}>
            {actionTitle(next, t)}
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
        ) : (
          <Link to="/bills/new" className={BUTTON_CLASS.primary}>
            {t('home.addBill')}
          </Link>
        )
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
          {showAtStake ? (
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

      {list.length > 0 && (
        <Card>
          <YearStrip months={yearMonths(list, lang)} />
        </Card>
      )}

      {/* D4a: the progress path and the headroom meter go here (retention plan 3.1 and 3.2). */}

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
