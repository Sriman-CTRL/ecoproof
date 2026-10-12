import { useTranslation } from 'react-i18next';
import { Card } from '../components/kit/Card';
import { RupeeHero } from '../components/kit/RupeeHero';
import { Skeleton } from '../components/kit/Skeleton';
import { StampBadge } from '../components/kit/StampBadge';
import { SolarChart } from '../components/SolarChart';
import { ErrorBox, monthLabel, Page } from '../components/ui';
import { formatDecimal, formatInr, formatNumber } from '../lib/format';
import { useSolarResults } from '../lib/solar';

/** HH-1 step 4: net-metering bills after installation: import, export and what changed. */
export default function HouseholdAfter() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const results = useSolarResults();
  const r = results.data;
  const tot = r?.totals;

  return (
    <Page tab="solar" showBusiness>
      <h1 className="font-heading text-title font-semibold">{t('household.after.title')}</h1>
      {results.isLoading && <Skeleton />}
      {results.isError && <ErrorBox>{t('household.after.loadFailed')}</ErrorBox>}
      {r && r.months.length === 0 && <p>{t('household.after.empty')}</p>}
      {r && r.months.length > 0 && tot && (
        <>
          <Card className="space-y-2">
            {r.installedKwp != null && (
              <p className="font-semibold">
                {t('household.after.installed', { kwp: formatDecimal(r.installedKwp) })}
              </p>
            )}
            {r.installedFrom && (
              <p className="text-small text-ink-muted">
                {t('household.after.since', { month: monthLabel(r.installedFrom, lang) })}
              </p>
            )}
            <SolarChart months={r.months} lang={lang} />
          </Card>

          <Card className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-small text-ink-muted">{t('household.after.savedLabel')}</p>
              {/* S8a rule: "Verified by your bills" only when the API says the test passed. */}
              <StampBadge variant={r.status === 'verified' ? 'verified' : 'early'} />
            </div>
            {tot.savedInr != null ? (
              <RupeeHero
                value={Math.round(tot.savedInr)}
                unitsText={
                  tot.savedKwh != null
                    ? t('household.after.savedUnits', { kwh: formatNumber(tot.savedKwh) })
                    : undefined
                }
                co2Text={
                  tot.gridTco2 != null
                    ? t('household.after.co2', { value: formatDecimal(tot.gridTco2) })
                    : undefined
                }
              />
            ) : (
              <>
                {tot.savedKwh != null && (
                  <p className="num font-heading text-title font-semibold">
                    {t('household.after.savedUnits', { kwh: formatNumber(tot.savedKwh) })}
                  </p>
                )}
                {tot.gridTco2 != null && (
                  <p className="text-ink-muted">
                    {t('household.after.co2', { value: formatDecimal(tot.gridTco2) })}
                  </p>
                )}
                <p className="text-small text-copper-800">{t('household.noRupees')}</p>
              </>
            )}
            <p className="text-small text-ink-muted">{t('household.after.methodNote')}</p>
          </Card>

          <Card className="px-2">
            <table className="w-full text-small">
              <caption className="py-2 text-left font-heading text-card-title font-semibold">
                {t('household.after.byMonth')}
              </caption>
              <thead>
                <tr className="border-b text-left text-ink-muted">
                  <th scope="col" className="py-2 pr-2 font-semibold">
                    {t('household.after.col.month')}
                  </th>
                  <th scope="col" className="py-2 pr-2 text-right font-semibold">
                    {t('household.after.col.saved')}
                  </th>
                  <th scope="col" className="py-2 pr-2 text-right font-semibold">
                    {t('household.after.col.import')}
                  </th>
                  <th scope="col" className="py-2 pr-2 text-right font-semibold">
                    {t('household.after.col.export')}
                  </th>
                  <th scope="col" className="py-2 text-right font-semibold">
                    {t('household.after.col.billed')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {r.months.map((m) => (
                  <tr key={m.month} className="border-b last:border-b-0">
                    <th scope="row" className="py-2 pr-2 text-left font-medium">
                      {monthLabel(m.month, lang)}
                    </th>
                    <td className="num py-2 pr-2 text-right font-semibold">
                      {m.savedInr != null
                        ? formatInr(Math.round(m.savedInr))
                        : m.savedKwh != null
                          ? `${formatNumber(m.savedKwh)} kWh`
                          : '-'}
                    </td>
                    <td className="num py-2 pr-2 text-right">{formatNumber(m.importKwh)}</td>
                    <td className="num py-2 pr-2 text-right">{formatNumber(m.exportKwh)}</td>
                    <td className="num py-2 text-right">{formatNumber(m.billedKwh)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="text-small text-ink-muted">{t('household.after.surplusNote')}</p>
        </>
      )}
    </Page>
  );
}
