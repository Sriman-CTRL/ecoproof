import type { TFunction } from 'i18next';
import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { Info } from '@phosphor-icons/react/dist/csr/Info';
import { BillStubCard } from '../components/kit/BillStubCard';
import { BottomSheet } from '../components/kit/BottomSheet';
import { Button } from '../components/kit/Button';
import { Card } from '../components/kit/Card';
import { EmptyState } from '../components/kit/EmptyState';
import type { JargonTerm } from '../components/kit/JargonChip';
import { RupeeHero } from '../components/kit/RupeeHero';
import { Skeleton } from '../components/kit/Skeleton';
import { StatusPill } from '../components/kit/StatusPill';
import { ErrorBox, monthLabel, Page } from '../components/ui';
import { api, type Finding, type Insights } from '../lib/api';
import { useActions } from './Actions';
import { formatDecimal, formatInr, formatNumber, formatRate } from '../lib/format';
import { getSession } from '../lib/session';

/**
 * month null = latest bill. Pass waitForMonth when the month is still loading, so a cached
 * "latest" answer from another screen (often last month's) is never shown for this bill.
 */
export function useInsights(
  month: string | null,
  shiftableKwh?: number | null,
  opts: { waitForMonth?: boolean } = {},
) {
  const siteId = getSession()?.siteId ?? '';
  const qs = new URLSearchParams();
  if (month) qs.set('month', month.slice(0, 7));
  if (shiftableKwh != null) qs.set('shiftableKwh', String(shiftableKwh));
  return useQuery({
    queryKey: ['insights', siteId, month, shiftableKwh ?? null],
    queryFn: () => api<Insights>(`/sites/${siteId}/insights?${qs}`),
    enabled: !opts.waitForMonth || month != null,
    // Keep the old answer only while the shiftable units change for the same month.
    placeholderData: (prev) =>
      prev && (month == null || prev.month.startsWith(month.slice(0, 7))) ? prev : undefined,
  });
}

export function ruleLine(f: Finding, t: TFunction): string {
  return t('health.rule', {
    line: f.rule.line,
    validFrom: f.rule.validFrom ?? t('health.unknown'),
  });
}

/** Which plain-words explainer sits under each finding. */
const JARGON: Record<string, JargonTerm> = {
  power_factor: 'powerFactor',
  peak_use: 'peakHours',
  contracted_demand: 'contractedDemand',
  minimum_charges: 'contractedDemand',
  lt_surcharges: 'powerFactor',
};

/** Biggest rupee finding first; findings that wait for an input go last. */
const biggestFirst = (a: Finding, b: Finding) => (b.inrPerMonth ?? -1) - (a.inrPerMonth ?? -1);

export default function Health() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const month = params.get('month');
  const [shiftable, setShiftable] = useState('');
  const shiftNum = shiftable.trim() === '' ? null : Number(shiftable.replace(/,/g, ''));
  const q = useInsights(month, shiftNum != null && Number.isFinite(shiftNum) ? shiftNum : null);
  const d = q.data;
  const lang = i18n.resolvedLanguage ?? 'en';
  const findings = d ? [...d.findings].sort(biggestFirst) : [];
  const topAction = useActions(month, true).data?.actions[0]?.code ?? null;

  return (
    <Page
      tab="plan"
      action={
        <Button
          disabled={!topAction}
          onClick={() =>
            topAction && navigate(`/actions/${topAction}${month ? `?month=${month}` : ''}`)
          }
        >
          {t('health.startTop')}
        </Button>
      }
    >
      {q.isLoading && (
        <>
          <Skeleton />
          <Skeleton />
        </>
      )}
      {q.isError && <ErrorBox>{t('health.loadFailed')}</ErrorBox>}
      {d && (
        <>
          <h1 className="font-heading text-title font-semibold">
            {t('health.title', { month: monthLabel(d.month, lang) })}
          </h1>
          <Card>
            <RupeeHero
              value={Math.round(d.atStake.inrPerMonth)}
              label={t('health.total')}
              countUpKey={`health-${d.month}`}
              source={{ lineName: t('results.healthSource'), month: monthLabel(d.month, lang) }}
            />
            {d.atStake.pendingCodes.includes('peak_use') && (
              <p className="mt-1 text-small text-ink-muted">{t('results.peakPending')}</p>
            )}
          </Card>
          {findings.length === 0 && (
            <EmptyState icon={Check} title={t('health.noFindings')} body={t('health.passed')} />
          )}
          {findings.map((f) => (
            <FindingCard key={f.code} f={f} shiftable={shiftable} onShiftable={setShiftable} />
          ))}
          {d.passed.length > 0 && (
            <section>
              <h2 className="mb-1 text-small font-semibold text-ink-muted">
                {t('health.passedTitle')}
              </h2>
              <ul className="space-y-1 rounded-card bg-paper p-3 text-ink-muted">
                {d.passed.map((f) => (
                  <li key={f.code} className="flex items-center gap-2">
                    <Check size={18} weight="bold" aria-hidden="true" />
                    {t(`health.passedLabel.${f.code}`)}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </Page>
  );
}

function FindingCard({
  f,
  shiftable,
  onShiftable,
}: {
  f: Finding;
  shiftable: string;
  onShiftable: (v: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const jargon = JARGON[f.code];
  const name = t(`health.name.${f.code}`);
  return (
    <div data-testid={`finding-${f.code}`}>
      <BillStubCard
        monthly={f.inrPerMonth}
        title={name}
        fix={t(`health.fix.${f.code}`)}
        source={{ lineName: ruleLine(f, t) }}
      >
        {f.inrPerMonth == null && (
          <p className="text-small font-semibold">{t('health.enterUnits')}</p>
        )}
        {(f.code === 'power_factor' || f.code === 'lt_surcharges') && (
          <StatusPill tone="check">{t('health.lowCostQuote')}</StatusPill>
        )}
        {f.code === 'peak_use' && (
          <label className="block text-small">
            <span className="font-semibold">{t('health.shiftable')}</span>
            <input
              inputMode="numeric"
              className="mt-1 min-h-12 w-full rounded-button border bg-surface px-3 text-body"
              value={shiftable}
              onChange={(e) => onShiftable(e.target.value.replace(/[^\d.,]/g, ''))}
            />
          </label>
        )}
        {jargon && <ExplainerLine f={f} term={jargon} />}
        <Button variant="secondary" aria-haspopup="dialog" onClick={() => setOpen(true)}>
          <Info size={20} aria-hidden="true" />
          {t('health.why')}
        </Button>
      </BillStubCard>
      <BottomSheet open={open} title={name} onClose={() => setOpen(false)}>
        <div className="space-y-2 text-small">
          <ul className="space-y-1">
            {Object.entries(f.explain).map(([k, v]) => (
              <li key={k} className="flex justify-between gap-3">
                <span className="text-ink-muted">{t(`health.key.${k}`, { defaultValue: k })}</span>
                <span className="num font-semibold">
                  {typeof v === 'number' ? formatDecimal(v) : (v ?? '-')}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-ink-muted">{ruleLine(f, t)}</p>
          <p className="text-ink-muted">{t('health.ruleSource', { source: f.rule.source })}</p>
          {f.assumption && <p className="text-ink-muted">{f.assumption}</p>}
        </div>
      </BottomSheet>
    </div>
  );
}

const num = (v: number | string | null | undefined): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

/**
 * The bill-specific explainer under a finding (retention plan 7), built only from that finding's
 * own explain data and rupee figure. Null when a number it needs is missing.
 */
export function explainLine(f: Finding, t: TFunction): string | null {
  const e = f.explain;
  const inr = num(f.inrPerMonth);
  switch (f.code) {
    case 'power_factor': {
      const [kvah, kwh, loss, rate] = [e.kvah, e.kwh, e.lossKvah, e.energyRatePerKvah].map(num);
      if (kvah == null || kwh == null || loss == null || rate == null || inr == null) return null;
      return t('health.explain.power_factor', {
        kvah: formatNumber(Math.round(kvah)),
        kwh: formatNumber(Math.round(kwh)),
        loss: formatNumber(Math.round(loss)),
        rate: formatRate(rate),
        inr: formatInr(Math.round(inr)),
      });
    }
    case 'peak_use': {
      const [peak, total, pct, surcharge] = [
        e.peakKwh,
        e.totalKwh,
        e.peakSharePct,
        e.peakSurchargeInrPerKwh,
      ].map(num);
      if (peak == null || total == null || pct == null || surcharge == null) return null;
      return t('health.explain.peak_use', {
        peak: formatNumber(Math.round(peak)),
        total: formatNumber(Math.round(total)),
        pct: formatDecimal(pct),
        surcharge: formatRate(surcharge),
      });
    }
    case 'contracted_demand': {
      const [cd, md, pct, rate] = [
        e.contractedDemandKva,
        e.maxMdKva12Months,
        e.flagIfMdBelowPctOfCd,
        e.demandRatePerKva,
      ].map(num);
      const months = num(e.monthsConsidered);
      if (cd == null || md == null || pct == null || rate == null || inr == null) return null;
      return t('health.explain.contracted_demand', {
        cd: formatNumber(cd),
        md: formatNumber(md),
        months: months ?? 12,
        pct: formatDecimal(pct),
        billed: formatNumber(Math.round((pct / 100) * cd)),
        rate: formatRate(rate),
        inr: formatInr(Math.round(inr)),
      });
    }
    case 'minimum_charges': {
      const [min, actual, gap, rate] = [
        e.minimumKvah,
        e.actualKvah,
        e.gapKvah,
        e.energyRatePerKvah,
      ].map(num);
      if (min == null || actual == null || gap == null || rate == null || inr == null) return null;
      return t('health.explain.minimum_charges', {
        min: formatNumber(Math.round(min)),
        actual: formatNumber(Math.round(actual)),
        gap: formatNumber(Math.round(gap)),
        rate: formatRate(rate),
        inr: formatInr(Math.round(inr)),
      });
    }
    case 'lt_surcharges':
      return inr == null
        ? null
        : t('health.explain.lt_surcharges', { inr: formatInr(Math.round(inr)) });
    default:
      return null;
  }
}

/** "What is power factor?" under a finding: the plain meaning, then what it cost on this bill. */
function ExplainerLine({ f, term }: { f: Finding; term: JargonTerm }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const id = useId();
  const word = t(`kit.jargon.${term}.term`);
  const own = explainLine(f, t);
  return (
    <div className="text-small">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="min-h-12 text-left font-semibold text-green-700 underline decoration-dotted underline-offset-4"
      >
        {t('kit.jargon.open', { term: word })}
      </button>
      {open && (
        <div
          id={id}
          className="space-y-1 rounded-card bg-green-50 p-3 text-ink"
          data-testid="explainer"
        >
          <p>{t(`kit.jargon.${term}.line`)}</p>
          {own && <p className="num font-semibold">{own}</p>}
        </div>
      )}
    </div>
  );
}
