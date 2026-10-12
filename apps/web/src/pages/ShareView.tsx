import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { DownloadSimple } from '@phosphor-icons/react/dist/csr/DownloadSimple';
import { Button } from '../components/kit/Button';
import {
  CheckFileButton,
  SealNote,
  VerifyCard,
  VerifyHeadline,
  VerifySkeleton,
  useHashCheck,
} from '../components/verify';
import { ErrorBox, Page } from '../components/ui';
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
  const check = useHashCheck(q.data?.sha256);
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
      isPublic
      action={
        q.data ? (
          <Button onClick={() => void download()}>
            <DownloadSimple size={24} aria-hidden="true" />
            {t(q.data.type === 'cbam_sheet' ? 'report.downloadExcel' : 'report.download')}
          </Button>
        ) : undefined
      }
    >
      {q.isLoading && <VerifySkeleton />}
      {status === 410 && <ErrorBox>{t('verify.expired')}</ErrorBox>}
      {status === 404 && <ErrorBox>{t('verify.linkNotFound')}</ErrorBox>}
      {q.isError && status !== 410 && status !== 404 && (
        <ErrorBox>{t('common.networkError')}</ErrorBox>
      )}
      {failed && <ErrorBox>{t('common.genericError')}</ErrorBox>}
      {q.data && (
        <>
          <VerifyHeadline result={check.result} />
          <VerifyCard v={q.data} />
          <CheckFileButton variant="secondary" onChange={check.onChange} busy={check.busy} />
          <SealNote expected={q.data.sha256} />
          <p className="text-small text-ink-muted">
            {t(q.data.type === 'cbam_sheet' ? 'cbam.statusNote' : 'detail.lenderNote')}
          </p>
        </>
      )}
    </Page>
  );
}
