import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { Files } from '@phosphor-icons/react/dist/csr/Files';
import { BUTTON_CLASS } from '../components/kit/Button';
import { CARD_CLASS } from '../components/kit/Card';
import { EmptyState } from '../components/kit/EmptyState';
import { Skeleton } from '../components/kit/Skeleton';
import { StampBadge } from '../components/kit/StampBadge';
import { ErrorBox, Page } from '../components/ui';
import { api } from '../lib/api';
import { milestoneDate } from '../lib/progress';
import { useMitraSummary, type MitraPage } from '../lib/mitra';
import { useReports } from '../lib/savings';
import { getSession } from '../lib/session';
import { useQuery } from '@tanstack/react-query';

interface ActionRow {
  code: string;
  status?: string;
}

/**
 * Where "Make a loan-ready summary" goes: the action detail page of the top planned or done
 * action, or the API's #1 action when none is started.
 */
function useSummaryTarget(): string {
  const siteId = getSession()?.siteId ?? '';
  const q = useQuery({
    queryKey: ['actions', siteId],
    queryFn: () => api<{ actions: ActionRow[] }>(`/sites/${siteId}/actions?all=1`),
  });
  const list = q.data?.actions ?? [];
  const pick =
    list.find((a) => a.status === 'planned') ??
    list.find((a) => a.status === 'in_progress') ??
    list.find((a) => a.status === 'done') ??
    list[0];
  return pick ? `/actions/${pick.code}` : '/actions';
}

/** D7 Mitra: two big cards on top, NGO and Govt, each with its progress and next free step. */
function MitraCards() {
  const { t } = useTranslation();
  const q = useMitraSummary();
  if (!q.data) return q.isLoading ? <Skeleton /> : null;
  return (
    <section className="space-y-2" data-testid="mitra-cards">
      <h2 className="font-heading text-card-title font-semibold">{t('reports.mitraTitle')}</h2>
      <div className="grid gap-3 lg:grid-cols-2 lg:gap-6">
        {(['govt', 'ngo'] as MitraPage[]).map((p) => {
          const s = q.data[p];
          return (
            <Link
              key={p}
              to={`/mitra/${p}`}
              className={`${CARD_CLASS} flex min-h-24 items-center justify-between gap-3 border-green-700`}
              data-testid={`mitra-card-${p}`}
            >
              <span className="space-y-1">
                <span className="block font-heading text-card-title font-semibold">
                  {t(`mitra.${p}.cardTitle`)}
                </span>
                <span className="num block text-small">
                  {t('mitra.progress', { done: s.done, total: s.total })}
                </span>
                <span className="block text-small text-ink-muted">
                  {s.next ? t('mitra.nextLine', { title: s.next.title }) : t('mitra.allDone')}
                </span>
              </span>
              <ArrowRight size={24} className="shrink-0 text-green-700" aria-hidden="true" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default function Reports() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const q = useReports();
  const target = useSummaryTarget();
  const rows = q.data ?? [];

  return (
    <Page
      tab="reports"
      action={
        <Link to={target} className={BUTTON_CLASS.primary} data-testid="primary-make">
          {t('reports.make')}
          <ArrowRight size={20} aria-hidden="true" />
        </Link>
      }
    >
      <h1 className="font-heading text-title font-semibold">{t('reports.title')}</h1>
      <MitraCards />
      <div className="grid gap-3 lg:grid-cols-2 lg:gap-6">
        <Link
          to="/reports/cbam/new"
          className={`${CARD_CLASS} flex min-h-12 items-center justify-between gap-2`}
          data-testid="cbam-create"
        >
          <span className="space-y-0.5">
            <span className="block font-semibold">{t('reports.cbamCreate')}</span>
            <span className="block text-small text-ink-muted">{t('reports.cbamCreateHelp')}</span>
          </span>
          <ArrowRight size={20} className="shrink-0 text-green-700" aria-hidden="true" />
        </Link>
        <Link
          to="/carbon"
          className={`${CARD_CLASS} flex min-h-12 items-center justify-between gap-2`}
          data-testid="carbon-create"
        >
          <span className="space-y-0.5">
            <span className="block font-semibold">{t('reports.carbonCreate')}</span>
            <span className="block text-small text-ink-muted">{t('reports.carbonCreateHelp')}</span>
          </span>
          <ArrowRight size={20} className="shrink-0 text-green-700" aria-hidden="true" />
        </Link>
      </div>
      {q.isLoading && <Skeleton />}
      {q.isError && <ErrorBox>{t('reports.loadFailed')}</ErrorBox>}
      {q.isSuccess && rows.length === 0 && (
        <EmptyState icon={Files} title={t('reports.emptyTitle')} body={t('reports.emptyBody')} />
      )}
      {rows.length > 0 && (
        <ul className="grid gap-2 lg:grid-cols-2 lg:gap-4">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                to={`/reports/${r.id}`}
                className={`${CARD_CLASS} block h-full space-y-1`}
                data-testid="report-row"
              >
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-semibold">
                    {t(`reports.type.${r.type}`, { defaultValue: r.type })}
                  </span>
                  <span className="num text-small text-ink-muted">
                    {t('reports.version', { n: r.version })}
                  </span>
                </span>
                <span className="num block text-small text-ink-muted">
                  {milestoneDate(r.createdAt, lang)}
                </span>
                {r.type === 'cbam_sheet' && (
                  <span className="block py-1">
                    <StampBadge variant="estimate" />
                  </span>
                )}
                <span className="block text-small">
                  {t('reports.shared', { shares: r.shareCount, count: r.viewCount })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
