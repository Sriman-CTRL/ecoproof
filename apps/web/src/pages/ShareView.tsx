import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { ErrorBox, Page, PRIMARY } from '../components/ui';
import { HashCheck, VerifyCard } from '../components/verify';
import { ApiError, publicApi, type VerifyView } from '../lib/api';

type Shared = VerifyView & { downloadUrl: string };

/** Public share link: the verify view plus the PDF. Each open and download is logged. */
export default function ShareView() {
  const { t } = useTranslation();
  const { token = '' } = useParams();
  const [failed, setFailed] = useState(false);
  const q = useQuery({
    queryKey: ['share', token],
    queryFn: () => publicApi<Shared>(`/public/shares/${encodeURIComponent(token)}`),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const status = q.error instanceof ApiError ? q.error.status : null;

  async function download() {
    setFailed(false);
    try {
      const r = await publicApi<Shared>(`/public/shares/${encodeURIComponent(token)}?download=1`);
      window.location.assign(r.downloadUrl);
    } catch {
      setFailed(true);
    }
  }

  return (
    <Page
      showBusiness={false}
      action={
        q.data ? (
          <button type="button" className={PRIMARY} onClick={() => void download()}>
            {t('report.download')}
          </button>
        ) : undefined
      }
    >
      <h1 className="text-xl font-bold">{t('verify.sharedTitle')}</h1>
      {q.isLoading && <p>{t('common.loading')}</p>}
      {status === 410 && <ErrorBox>{t('verify.expired')}</ErrorBox>}
      {status === 404 && <ErrorBox>{t('verify.linkNotFound')}</ErrorBox>}
      {q.isError && status !== 410 && status !== 404 && (
        <ErrorBox>{t('common.networkError')}</ErrorBox>
      )}
      {failed && <ErrorBox>{t('common.genericError')}</ErrorBox>}
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
