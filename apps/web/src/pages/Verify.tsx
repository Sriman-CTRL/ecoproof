import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { ErrorBox, Page } from '../components/ui';
import { HashCheck, VerifyCard } from '../components/verify';
import { ApiError, publicApi, type VerifyView } from '../lib/api';

/** Public, no login, no consent gate: what a lender sees after scanning the QR code. */
export default function Verify() {
  const { t } = useTranslation();
  const { reportId = '' } = useParams();
  const q = useQuery({
    queryKey: ['verify', reportId],
    queryFn: () => publicApi<VerifyView>(`/public/reports/${reportId}/verify`),
    retry: false,
  });
  return (
    <Page showBusiness={false}>
      <h1 className="text-xl font-bold">{t('verify.title')}</h1>
      {q.isLoading && <p>{t('common.loading')}</p>}
      {q.isError && (
        <ErrorBox>
          {q.error instanceof ApiError && q.error.status === 404
            ? t('verify.notFound')
            : t('common.networkError')}
        </ErrorBox>
      )}
      {q.data && (
        <>
          <VerifyCard v={q.data} />
          <HashCheck expected={q.data.sha256} />
          <p className="text-xs text-gray-500">{t('detail.lenderNote')}</p>
        </>
      )}
    </Page>
  );
}
