import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import {
  CheckFileButton,
  noteKey,
  SealNote,
  VerifyCard,
  VerifyHeadline,
  VerifySkeleton,
  useHashCheck,
} from '../components/verify';
import { ErrorBox, Page } from '../components/ui';
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
  const check = useHashCheck(q.data?.sha256);
  return (
    <Page
      isPublic
      action={
        q.data ? (
          <CheckFileButton variant="primary" onChange={check.onChange} busy={check.busy} />
        ) : undefined
      }
    >
      {q.isLoading && <VerifySkeleton />}
      {q.isError && (
        <ErrorBox>
          {q.error instanceof ApiError && q.error.status === 404
            ? t('verify.notFound')
            : t('common.networkError')}
        </ErrorBox>
      )}
      {q.data && (
        <>
          <VerifyHeadline result={check.result} />
          <VerifyCard v={q.data} />
          <SealNote expected={q.data.sha256} />
          <p className="text-small text-ink-muted">{t(noteKey(q.data.type))}</p>
        </>
      )}
    </Page>
  );
}
