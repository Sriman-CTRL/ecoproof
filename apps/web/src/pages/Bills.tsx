import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Receipt } from '@phosphor-icons/react/dist/csr/Receipt';
import { BUTTON_CLASS } from '../components/kit/Button';
import { Card } from '../components/kit/Card';
import { EmptyState } from '../components/kit/EmptyState';
import { Skeleton } from '../components/kit/Skeleton';
import { YearStrip } from '../components/kit/YearStrip';
import { MonthLedger } from '../components/MonthLedger';
import { ErrorBox, Page, yearMonths } from '../components/ui';
import { api, type MonthRow } from '../lib/api';
import { getSession, isHousehold } from '../lib/session';

/** Tab target: every confirmed bill as a ledger, plus the year strip. */
export default function Bills() {
  const { t, i18n } = useTranslation();
  const siteId = getSession()?.siteId ?? '';
  const months = useQuery({
    queryKey: ['months', siteId],
    queryFn: () => api<MonthRow[]>(`/sites/${siteId}/months`),
  });
  const list = months.data ?? [];
  // Households: list view only for now; the bill reader handles HT/LT-III business bills.
  const household = isHousehold();
  return (
    <Page
      tab="bills"
      action={
        household ? undefined : (
          <Link to="/bills/new" className={BUTTON_CLASS.primary}>
            {t('home.addBill')}
          </Link>
        )
      }
    >
      <h1 className="font-heading text-title font-semibold">{t('bills.title')}</h1>
      {months.isError && <ErrorBox>{t('home.loadFailed')}</ErrorBox>}
      {months.isLoading && (
        <>
          <Skeleton />
          <Skeleton />
        </>
      )}
      {months.isSuccess && list.length === 0 && (
        <EmptyState icon={Receipt} title={t('bills.emptyTitle')} body={t('bills.emptyBody')} />
      )}
      {list.length > 0 && (
        <>
          <Card>
            <YearStrip
              months={yearMonths(list, i18n.resolvedLanguage ?? 'en')}
              showBaseline={!household}
            />
          </Card>
          <MonthLedger rows={list} linkResults={!household} />
          <p className="text-small text-ink-muted">
            {t(household ? 'household.billsNote' : 'bills.co2Note')}
          </p>
        </>
      )}
    </Page>
  );
}
