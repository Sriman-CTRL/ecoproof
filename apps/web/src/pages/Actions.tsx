import type { TFunction } from 'i18next';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ListChecks } from '@phosphor-icons/react/dist/csr/ListChecks';
import { Button } from '../components/kit/Button';
import { Card } from '../components/kit/Card';
import { EmptyState } from '../components/kit/EmptyState';
import { Skeleton } from '../components/kit/Skeleton';
import { SourceChip } from '../components/kit/SourceChip';
import { StatusPill, type PillTone } from '../components/kit/StatusPill';
import { CostText, ErrorBox, Page } from '../components/ui';
import { api, type ActionItem, type ActionsResponse } from '../lib/api';
import { formatDecimal, formatInr } from '../lib/format';
import { getSession } from '../lib/session';

export function useActions(month: string | null, all: boolean, enabled = true) {
  const siteId = getSession()?.siteId ?? '';
  const qs = new URLSearchParams();
  if (month) qs.set('month', month.slice(0, 7));
  if (all) qs.set('all', '1');
  return useQuery({
    queryKey: ['actions', siteId, month, all],
    enabled,
    queryFn: () => api<ActionsResponse>(`/sites/${siteId}/actions?${qs}`),
  });
}

export const actionTitle = (a: ActionItem, t: TFunction) =>
  t(`actions.name.${a.code}`, { defaultValue: a.title });

const STATUS_TONE: Record<string, PillTone> = {
  suggested: 'neutral',
  planned: 'check',
  in_progress: 'check',
  done: 'positive',
};

export function ActionStatus({ status }: { status: string }) {
  const { t } = useTranslation();
  const key = status in STATUS_TONE ? status : 'suggested';
  return <StatusPill tone={STATUS_TONE[key]}>{t(`actions.status.${key}`)}</StatusPill>;
}

/**
 * Only truly zero-cost actions carry the badge: the cost range must be a known zero. The power
 * factor fix is a capacitor bank, so it says "Low cost, quote needed" (decided 12 Oct).
 */
export function CostBadge({ a }: { a: ActionItem }) {
  const { t } = useTranslation();
  if (a.isZeroCost && a.costLow === 0 && a.costHigh === 0) {
    return <StatusPill tone="positive">{t('actions.zeroCost')}</StatusPill>;
  }
  if (a.code === 'fix_power_factor') {
    return <StatusPill tone="check">{t('actions.lowCostQuote')}</StatusPill>;
  }
  return null;
}

/** One ledger row: title and status on top, then rupees a year, cost and payback in columns. */
export function ActionRow({ a, month }: { a: ActionItem; month: string | null }) {
  const { t } = useTranslation();
  return (
    <li className="space-y-2 border-b py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <Link
          to={`/actions/${a.code}${month ? `?month=${month}` : ''}`}
          className="inline-flex min-h-12 items-center font-heading text-card-title font-semibold text-green-700 underline underline-offset-4"
        >
          {actionTitle(a, t)}
        </Link>
        <ActionStatus status={a.status} />
      </div>
      <div className="flex flex-wrap gap-1">
        <CostBadge a={a} />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-small">
        <dt className="text-ink-muted">{t('actions.perYear')}</dt>
        <dd className="num font-semibold">
          {a.annualInrMid != null ? (
            <SourceChip lineName={a.source}>{formatInr(Math.round(a.annualInrMid))}</SourceChip>
          ) : (
            t(a.finding ? 'actions.savingPending' : 'actions.savingPendingOther')
          )}
        </dd>
        <dt className="text-ink-muted">{t('actions.cost')}</dt>
        <dd className="num">
          <CostText low={a.costLow} high={a.costHigh} />
        </dd>
        <dt className="text-ink-muted">{t('actions.payback')}</dt>
        <dd className="num">
          {a.paybackYears != null ? t('actions.years', { n: formatDecimal(a.paybackYears) }) : '-'}
        </dd>
      </dl>
    </li>
  );
}

export default function Actions() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const month = params.get('month');
  const [all, setAll] = useState(false);
  const q = useActions(month, all);
  const d = q.data;
  const first = d?.actions[0];
  return (
    <Page
      tab="plan"
      action={
        <Button
          disabled={!first}
          onClick={() =>
            first && navigate(`/actions/${first.code}${month ? `?month=${month}` : ''}`)
          }
        >
          {t('actions.openTop')}
        </Button>
      }
    >
      <h1 className="font-heading text-title font-semibold">{t('actions.title')}</h1>
      {q.isLoading && (
        <>
          <Skeleton />
          <Skeleton />
        </>
      )}
      {q.isError && <ErrorBox>{t('actions.loadFailed')}</ErrorBox>}
      {d && d.actions.length === 0 && (
        <EmptyState icon={ListChecks} title={t('actions.emptyTitle')} body={t('actions.none')} />
      )}
      {d && d.actions.length > 0 && (
        <Card className="py-1">
          <ul>
            {d.actions.map((a) => (
              <ActionRow key={a.code} a={a} month={month} />
            ))}
          </ul>
        </Card>
      )}
      {d && !all && d.total > d.actions.length && (
        <Button variant="secondary" className="w-full" onClick={() => setAll(true)}>
          {t('actions.seeAll', { n: d.total })}
        </Button>
      )}
      <p className="text-small text-ink-muted">
        <SourceChip lineName={t('actions.rankNote')}>{t('actions.rankLabel')}</SourceChip>
      </p>
    </Page>
  );
}
