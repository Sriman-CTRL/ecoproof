import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowSquareOut } from '@phosphor-icons/react/dist/csr/ArrowSquareOut';
import { BottomSheet } from '../components/kit/BottomSheet';
import { BUTTON_CLASS } from '../components/kit/Button';
import { Card } from '../components/kit/Card';
import { Button } from '../components/kit/Button';
import { Skeleton } from '../components/kit/Skeleton';
import { ErrorBox, Page, Rupees } from '../components/ui';
import { formatDecimal, formatNumber } from '../lib/format';
import { useSolarPlan, type SolarPlan } from '../lib/solar';

/** One labelled figure row: label left, value right, an optional note underneath. */
function Row({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="border-b py-2 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <span>{label}</span>
        <span className="num text-right font-semibold">{value}</span>
      </div>
      {note && <p className="text-small text-ink-muted">{note}</p>}
    </div>
  );
}

function limitText(p: SolarPlan, t: (k: string, o?: Record<string, unknown>) => string) {
  const i = p.inputs;
  if (p.limitedBy === 'roof') {
    return t('household.solar.limited.roof', {
      roof: formatNumber(i.roofAreaM2),
      area: formatNumber(i.areaPerKwp),
    });
  }
  if (p.limitedBy === 'use') {
    return t('household.solar.limited.use', {
      kwh: formatNumber(Math.round(i.annualKwh)),
      yield: formatDecimal(i.yieldKwhPerKwpYr),
    });
  }
  return t('household.solar.limited.cap', { cap: formatDecimal(i.capKw) });
}

/** HH-1 step 3: size rooftop solar, estimate the PM Surya Ghar subsidy, link to the portal. */
export default function HouseholdSolar() {
  const { t } = useTranslation();
  const plan = useSolarPlan();
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const p = plan.data;
  const pending = (
    <span className="font-normal text-ink-muted">{t('household.solar.pending')}</span>
  );

  return (
    <Page
      tab="solar"
      showBusiness
      action={
        <a
          href={p?.portalUrl ?? 'https://pmsuryaghar.gov.in/'}
          target="_blank"
          rel="noopener noreferrer"
          className={`${BUTTON_CLASS.primary} gap-2`}
        >
          {t('household.solar.openPortal')}
          <ArrowSquareOut size={20} aria-hidden="true" />
        </a>
      }
    >
      <h1 className="font-heading text-title font-semibold">{t('household.solar.title')}</h1>
      {plan.isLoading && <Skeleton />}
      {plan.isError && <ErrorBox>{t('household.solar.loadFailed')}</ErrorBox>}
      {p && (
        <>
          <Card className="space-y-2">
            <p className="text-small text-ink-muted">{t('household.solar.sizeLabel')}</p>
            {p.belowMinimum ? (
              <p>{t('household.solar.belowMinimum')}</p>
            ) : (
              <p className="num font-heading text-hero font-semibold">
                {t('household.solar.size', { kwp: formatDecimal(p.kwp) })}
              </p>
            )}
            <p>{limitText(p, t)}</p>
            <p className="text-small text-ink-muted">
              {t('household.solar.conservative', {
                area: formatNumber(p.conservative.areaPerKwp),
                kwp: formatDecimal(p.conservative.kwp),
              })}
            </p>
          </Card>

          {!p.belowMinimum && (
            <Card className="px-4 py-2">
              {/* Rupees first, kWh second, CO2 third. */}
              <Row
                label={t('household.solar.savingLabel')}
                value={
                  p.monthlySavingInr == null ? (
                    pending
                  ) : (
                    <Rupees value={Math.round(p.monthlySavingInr)} />
                  )
                }
                note={`${t('household.solar.savingNote')} ${t('household.fsaNote')}`}
              />
              <Row
                label={t('household.solar.costLabel')}
                value={<Rupees value={p.benchmarkCostInr} />}
                note={t('household.solar.costNote')}
              />
              <Row
                label={t('household.solar.cfaLabel')}
                value={<Rupees value={p.cfaInr} />}
                note={t('household.solar.cfaNote')}
              />
              <Row label={t('household.solar.netLabel')} value={<Rupees value={p.netCostInr} />} />
              <Row
                label={t('household.solar.paybackLabel')}
                value={
                  p.paybackYears == null
                    ? pending
                    : p.paybackYears < 1
                      ? t('household.solar.paybackMonths', {
                          value: formatDecimal(Math.round(p.paybackYears * 12 * 10) / 10),
                        })
                      : t('household.solar.paybackYears', { value: formatDecimal(p.paybackYears) })
                }
              />
              <p className="pt-2 text-small">
                {t('household.solar.genLine', { kwh: formatNumber(Math.round(p.annualGenKwh)) })}
              </p>
              <p className="pb-1 text-small text-ink-muted">
                {t('household.solar.co2Line', { value: formatDecimal(p.co2AvoidedT) })}
              </p>
            </Card>
          )}

          <Card className="space-y-2">
            <h2 className="font-heading text-card-title font-semibold">
              {t('household.solar.conditionsTitle')}
            </h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>{t('household.solar.condition1')}</li>
              <li>{t('household.solar.condition2')}</li>
              <li>{t('household.solar.condition3')}</li>
            </ul>
            <p className="text-small text-ink-muted">{t('household.solar.surplus')}</p>
            <a
              href={p.portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${BUTTON_CLASS.secondary} gap-1`}
            >
              {t('household.solar.applyLink')}
              <ArrowSquareOut size={18} aria-hidden="true" />
            </a>
          </Card>

          <Button variant="secondary" onClick={() => setSourcesOpen(true)}>
            {t('household.solar.sources')}
          </Button>
          <BottomSheet
            open={sourcesOpen}
            title={t('household.solar.sourcesTitle')}
            onClose={() => setSourcesOpen(false)}
          >
            <ul className="space-y-3 text-small">
              {p.sources.map((s) => (
                <li key={s.key} className="space-y-1">
                  <p className="font-semibold">
                    {s.value != null && (
                      <span className="num">
                        {formatDecimal(s.value)} {s.unit}:{' '}
                      </span>
                    )}
                    {s.source}
                  </p>
                  {s.quotedLine && <p className="italic text-ink-muted">“{s.quotedLine}”</p>}
                  <p className="text-ink-muted">
                    {[s.page, s.date].filter(Boolean).join(' · ')}
                    {s.url && (
                      <>
                        {' '}
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-12 items-center break-all text-green-700 underline"
                        >
                          {new URL(s.url).hostname}
                        </a>
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </BottomSheet>
        </>
      )}
    </Page>
  );
}
