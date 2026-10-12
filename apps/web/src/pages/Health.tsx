import type { TFunction } from 'i18next';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { Info } from '@phosphor-icons/react/dist/csr/Info';
import { BillStubCard } from '../components/kit/BillStubCard';
import { BottomSheet } from '../components/kit/BottomSheet';
import { Button } from '../components/kit/Button';
import { Card } from '../components/kit/Card';
import { EmptyState } from '../components/kit/EmptyState';
import { JargonChip, type JargonTerm } from '../components/kit/JargonChip';
import { RupeeHero } from '../components/kit/RupeeHero';
import { Skeleton } from '../components/kit/Skeleton';
import { StatusPill } from '../components/kit/StatusPill';
import { ErrorBox, monthLabel, Page } from '../components/ui';
import { api, type Finding, type Insights } from '../lib/api';
import { useActions } from './Actions';
import { formatDecimal } from '../lib/format';
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
        {jargon && (
          <p className="text-small text-ink-muted">
            <JargonChip term={jargon} />
          </p>
        )}
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
