import type { TFunction } from 'i18next';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CostText, ErrorBox, Page, PRIMARY, Rupees, SourceNumber } from '../components/ui';
import { api, type ActionItem, type ActionsResponse } from '../lib/api';
import { formatDecimal } from '../lib/format';
import { getSession } from '../lib/session';

export function useActions(month: string | null, all: boolean) {
  const siteId = getSession()?.siteId ?? '';
  const qs = new URLSearchParams();
  if (month) qs.set('month', month.slice(0, 7));
  if (all) qs.set('all', '1');
  return useQuery({
    queryKey: ['actions', siteId, month, all],
    queryFn: () => api<ActionsResponse>(`/sites/${siteId}/actions?${qs}`),
  });
}

export const actionTitle = (a: ActionItem, t: TFunction) =>
  t(`actions.name.${a.code}`, { defaultValue: a.title });

export function ActionCard({ a, month }: { a: ActionItem; month: string | null }) {
  const { t } = useTranslation();
  return (
    <Link
      to={`/actions/${a.code}${month ? `?month=${month}` : ''}`}
      className="block min-h-12 space-y-2 rounded-2xl bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold">{actionTitle(a, t)}</h2>
        {a.isZeroCost && (
          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
            {t('actions.zeroCost')}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold">
        {a.annualInrMid != null ? (
          <>
            <Rupees value={a.annualInrMid} />{' '}
            <span className="text-base font-normal text-gray-600">{t('actions.perYear')}</span>
          </>
        ) : (
          <span className="text-base font-semibold">
            {t(a.finding ? 'actions.savingPending' : 'actions.savingPendingOther')}
          </span>
        )}
      </p>
      <p className="text-sm text-gray-700">
        {t('actions.cost')}: <CostText low={a.costLow} high={a.costHigh} />
      </p>
      <p className="text-sm text-gray-700">
        {t('actions.payback')}:{' '}
        {a.paybackYears != null ? t('actions.years', { n: formatDecimal(a.paybackYears) }) : '-'}
      </p>
    </Link>
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
      action={
        <button
          type="button"
          className={PRIMARY}
          disabled={!first}
          onClick={() =>
            first && navigate(`/actions/${first.code}${month ? `?month=${month}` : ''}`)
          }
        >
          {t('actions.openFirst')}
        </button>
      }
    >
      <h1 className="text-xl font-bold">{t('actions.title')}</h1>
      {q.isLoading && <p>{t('common.loading')}</p>}
      {q.isError && <ErrorBox>{t('actions.loadFailed')}</ErrorBox>}
      {d && d.actions.length === 0 && (
        <p className="rounded-xl bg-white p-5 shadow-sm">{t('actions.none')}</p>
      )}
      {d?.actions.map((a) => (
        <ActionCard key={a.code} a={a} month={month} />
      ))}
      {d && !all && d.total > d.actions.length && (
        <button type="button" className="min-h-12 w-full underline" onClick={() => setAll(true)}>
          {t('actions.seeAll', { n: d.total })}
        </button>
      )}
      <p className="text-xs text-gray-500">
        <SourceNumber source={t('actions.rankNote')}>{t('actions.rankLabel')}</SourceNumber>
      </p>
    </Page>
  );
}
