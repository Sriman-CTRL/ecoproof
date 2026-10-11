import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorBox, monthLabel, Page, PRIMARY, Rupees, SourceNumber } from '../components/ui';
import { api, type MonthRow } from '../lib/api';
import { formatDecimal, formatNumber } from '../lib/format';
import { getSession } from '../lib/session';

interface LatestDoc {
  id: string;
  status: string;
}

export function Co2Line({ m }: { m: MonthRow }) {
  const { t } = useTranslation();
  if (!m.co2) return <span className="text-gray-500">{t('home.noCarbon')}</span>;
  const total = (m.co2.scope2TCo2Grid ?? 0) + (m.co2.scope1TCo2eFuels ?? 0);
  return (
    <>
      {formatDecimal(total)} <span className="text-gray-600">{m.co2.label}</span>
    </>
  );
}

export default function Home() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const siteId = getSession()?.siteId ?? '';
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
  const lang = i18n.resolvedLanguage ?? 'en';
  const resume = latestDoc.data;
  const resumeTo =
    resume?.status === 'extracted'
      ? `/bills/${resume.id}/confirm`
      : resume && ['received', 'needs_manual'].includes(resume.status)
        ? `/bills/new?doc=${resume.id}`
        : null;

  return (
    <Page
      action={
        <button type="button" className={PRIMARY} onClick={() => navigate('/bills/new')}>
          📷 {t('home.addBill')}
        </button>
      }
    >
      {months.isError && <ErrorBox>{t('home.loadFailed')}</ErrorBox>}
      {months.isLoading && <p>{t('common.loading')}</p>}

      {resumeTo && (
        <Link
          to={resumeTo}
          className="block rounded-xl border-2 border-amber-500 bg-amber-50 p-3 font-medium"
        >
          ➜ {t('home.resume')}
        </Link>
      )}

      {top && (
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h1 className="text-sm font-medium text-gray-600">
            {t('home.latestBill', { month: monthLabel(top.month, lang) })}
          </h1>
          <p className="mt-1 text-3xl font-bold">
            {top.rupees.total != null ? (
              <SourceNumber source={t('home.sourceBill', { month: monthLabel(top.month, lang) })}>
                <Rupees value={top.rupees.total} />
              </SourceNumber>
            ) : (
              '-'
            )}
          </p>
          <p className="text-xs text-gray-500">{t('home.billTotal')}</p>
          <p className="mt-3 text-lg">
            {top.kwh != null ? formatNumber(top.kwh) : '-'}{' '}
            <span className="text-gray-600">{t('common.units')}</span>
          </p>
          <p className="mt-1 text-lg">
            <Co2Line m={top} />
          </p>
        </section>
      )}

      {months.isSuccess && list.length === 0 && (
        <p className="rounded-xl bg-white p-5 text-lg shadow-sm">{t('home.empty')}</p>
      )}

      {list.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">{t('home.months')}</h2>
          <ul className="divide-y rounded-xl bg-white shadow-sm">
            {list.map((m) => {
              const row = (
                <div className="flex items-center justify-between gap-3 p-3">
                  <div>
                    <div className="font-medium">{monthLabel(m.month, lang)}</div>
                    <div className="text-xs text-gray-600">
                      {m.kwh != null ? `${formatNumber(m.kwh)} ${t('common.unitsShort')}` : ''}
                    </div>
                  </div>
                  <div className="text-right font-semibold">
                    {m.rupees.total != null ? <Rupees value={m.rupees.total} /> : '-'}
                  </div>
                </div>
              );
              return (
                <li key={m.month}>
                  {m.resultId ? <Link to={`/results/${m.resultId}`}>{row}</Link> : row}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </Page>
  );
}
