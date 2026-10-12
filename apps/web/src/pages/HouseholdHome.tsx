import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Receipt } from '@phosphor-icons/react/dist/csr/Receipt';
import { Sun } from '@phosphor-icons/react/dist/csr/Sun';
import { BUTTON_CLASS } from '../components/kit/Button';
import { Card } from '../components/kit/Card';
import { EmptyState } from '../components/kit/EmptyState';
import { RupeeHero } from '../components/kit/RupeeHero';
import { Skeleton } from '../components/kit/Skeleton';
import { SourceChip } from '../components/kit/SourceChip';
import { YearStrip } from '../components/kit/YearStrip';
import { ErrorBox, monthLabel, Page, SwitchSample, yearMonths } from '../components/ui';
import { api, type MonthRow } from '../lib/api';
import { formatDecimal, formatInr, formatNumber } from '../lib/format';
import { getSession } from '../lib/session';
import { useSolarPlan } from '../lib/solar';

/** HH-1 household home: the latest bill, its units and CO2, and the rooftop solar plan. */
export default function HouseholdHome() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const siteId = getSession()?.siteId ?? '';
  const months = useQuery({
    queryKey: ['months', siteId],
    queryFn: () => api<MonthRow[]>(`/sites/${siteId}/months`),
  });
  const plan = useSolarPlan();
  const list = months.data ?? [];
  const top = list[0];
  const month = top ? monthLabel(top.month, lang) : '';
  const source = t('home.sourceBill', { month });
  const afterCount = list.filter((m) => m.solarInstalledKwp != null).length;
  // After solar the headline is what the DISCOM bills (net units); Scope 2 stays on bought units.
  const hasExport = top?.exportKwh != null;
  const headlineKwh = hasExport ? (top?.billedKwh ?? 0) : (top?.kwh ?? 0);
  const unitsLine = t(hasExport ? 'household.billedUnitsLine' : 'household.unitsLine', {
    kwh: formatNumber(headlineKwh),
  });
  const boughtSent = hasExport
    ? t('household.boughtSent', {
        bought: formatNumber(top?.kwh ?? 0),
        sent: formatNumber(top?.exportKwh ?? 0),
      })
    : null;
  const p = plan.data;

  return (
    <Page
      tab="home"
      showBusiness
      action={
        <Link to="/household/solar" className={BUTTON_CLASS.primary}>
          {t('household.seePlan')}
        </Link>
      }
    >
      <h1 className="font-heading text-title font-semibold">{t('household.homeTitle')}</h1>
      {months.isError && <ErrorBox>{t('household.loadFailed')}</ErrorBox>}
      {months.isLoading && <Skeleton />}
      {months.isSuccess && !top && (
        <EmptyState icon={Receipt} title={t('bills.emptyTitle')} body={t('bills.emptyBody')} />
      )}
      {top && (
        <Card className="space-y-2">
          <p className="text-small text-ink-muted">{t('household.latestBill', { month })}</p>
          {top.rupees.total != null ? (
            <RupeeHero
              value={Math.round(top.rupees.total)}
              countUpKey={`hh-bill-${top.month}`}
              source={{ lineName: source, month, quality: 'fromBill' }}
              unitsText={unitsLine}
              co2Text={
                top.co2?.scope2TCo2Grid != null
                  ? t('household.co2Line', { value: formatDecimal(top.co2.scope2TCo2Grid) })
                  : undefined
              }
            />
          ) : (
            <>
              <p className="num font-heading text-title font-semibold">
                <SourceChip lineName={source} month={month} quality="fromBill">
                  {unitsLine}
                </SourceChip>
              </p>
              {top.co2?.scope2TCo2Grid != null && (
                <p className="text-ink-muted">
                  {t('household.co2Line', { value: formatDecimal(top.co2.scope2TCo2Grid) })}
                </p>
              )}
              <p className="text-small text-copper-800">{t('household.noRupees')}</p>
            </>
          )}
          {boughtSent && <p className="text-small text-ink-muted">{boughtSent}</p>}
          {top.rupees.total != null && (
            <p className="text-small text-ink-muted">{t('household.fsaNote')}</p>
          )}
          <YearStrip months={yearMonths(list, lang)} showBaseline={false} />
        </Card>
      )}

      <Card className="space-y-2">
        <h2 className="flex items-center gap-2 font-heading text-card-title font-semibold">
          <Sun size={24} aria-hidden="true" className="text-copper-700" />
          {t('household.solarCardTitle')}
        </h2>
        {plan.isLoading && <Skeleton />}
        {plan.isError && <ErrorBox>{t('household.solar.loadFailed')}</ErrorBox>}
        {p && (
          <p>
            {p.belowMinimum
              ? t('household.solarCardBelow')
              : t('household.solarCardBody', {
                  kwp: formatDecimal(p.kwp),
                  cfa: formatInr(p.cfaInr),
                })}
          </p>
        )}
        {p && !p.belowMinimum && (
          <p className="text-small text-ink-muted">{t('household.solar.cfaNote')}</p>
        )}
      </Card>

      {afterCount > 0 && (
        <Card className="space-y-2">
          <h2 className="font-heading text-card-title font-semibold">
            {t('household.afterCardTitle')}
          </h2>
          <p>{t('household.afterCardBody', { n: afterCount })}</p>
          <Link to="/household/after" className={BUTTON_CLASS.secondary}>
            {t('household.seeAfter')}
          </Link>
        </Card>
      )}
      <SwitchSample />
    </Page>
  );
}
