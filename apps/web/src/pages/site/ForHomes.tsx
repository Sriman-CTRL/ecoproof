import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Band,
  LINK_BTN,
  PageHero,
  PublicLayout,
  SectionTitle,
} from '../../components/site/PublicLayout';
import { SampleSkeleton } from '../../components/site/SampleSkeleton';
import { formatDecimal, formatInr } from '../../lib/format';
import { usePublicSample } from '../../lib/publicSample';

const t2 = (n: number) => formatDecimal(Math.round(n * 100) / 100);

export default function ForHomes() {
  const { t } = useTranslation();
  const sample = usePublicSample();
  const plan = sample.data?.household.plan;
  const results = sample.data?.household.results;
  const rows: Array<[string, string]> = plan
    ? [
        ['kwp', t('site.homes.kwpValue', { kwp: formatDecimal(plan.kwp) })],
        ['subsidy', formatInr(plan.cfaInr)],
        ['net', formatInr(plan.netCostInr)],
        ...(plan.monthlySavingInr != null
          ? ([['saving', formatInr(Math.round(plan.monthlySavingInr))]] as Array<[string, string]>)
          : []),
        ...(plan.paybackYears != null
          ? ([['payback', t('site.homes.years', { n: formatDecimal(plan.paybackYears) })]] as Array<
              [string, string]
            >)
          : []),
        ['co2', `${t2(plan.co2AvoidedT)} t CO2`],
      ]
    : [];
  return (
    <PublicLayout>
      <PageHero title={t('site.homes.title')} lead={t('site.homes.lead')} />
      <Band defer={false}>
        <div className="grid gap-8 md:grid-cols-2 md:items-start">
          <div className="space-y-4">
            <SectionTitle>{t('site.homes.plan')}</SectionTitle>
            <p className="text-small font-semibold text-copper-800">{t('site.homeTag')}</p>
            {plan ? (
              <dl
                className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 rounded-card border bg-surface p-4 shadow-card"
                data-testid="homes-plan"
              >
                {rows.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-ink-muted">{t(`site.homes.${k}`)}</dt>
                    <dd
                      className={`num text-right font-semibold ${k === 'co2' ? 'text-green-700' : ''}`}
                    >
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <SampleSkeleton error={sample.isError} />
            )}
          </div>
          <div className="space-y-4">
            <p>{t('site.homes.slabs')}</p>
            {results && results.totals.savedInr != null && results.months.length > 0 && (
              <p className="rounded-card bg-green-50 p-4 font-semibold text-green-700">
                {t('site.homes.after', {
                  months: results.months.length,
                  inr: formatInr(Math.round(results.totals.savedInr)),
                })}
              </p>
            )}
            {plan && (
              <p className="text-small text-ink-muted">
                <a
                  href={plan.portalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-green-700 underline underline-offset-4"
                >
                  {t('site.homes.portal')}
                </a>
              </p>
            )}
            <Link to="/start" className={`${LINK_BTN} bg-green-700 text-white`}>
              {t('site.homes.try')}
            </Link>
          </div>
        </div>
      </Band>
    </PublicLayout>
  );
}
