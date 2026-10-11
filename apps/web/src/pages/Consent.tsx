import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ErrorBox, Page, PRIMARY } from '../components/ui';
import { postJson } from '../lib/api';

export const NOTICE_VERSION = 'v1-demo';

export default function Consent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const agree = useMutation({
    mutationFn: () =>
      postJson('/consents', { noticeVersion: NOTICE_VERSION, purpose: 'processing' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['consent'] });
      navigate('/home', { replace: true });
    },
  });

  const rows = ['store', 'why', 'who', 'delete'] as const;
  return (
    <Page
      action={
        <button
          type="button"
          className={PRIMARY}
          disabled={agree.isPending}
          onClick={() => agree.mutate()}
        >
          {t('consent.agree')}
        </button>
      }
    >
      <h1 className="text-2xl font-bold">{t('consent.title')}</h1>
      <p className="text-gray-700">{t('consent.intro')}</p>
      {agree.isError && <ErrorBox>{t('consent.failed')}</ErrorBox>}
      <dl className="space-y-3">
        {rows.map((k) => (
          <div key={k} className="rounded-xl bg-white p-4 shadow-sm">
            <dt className="font-semibold">{t(`consent.${k}Title`)}</dt>
            <dd className="mt-1 text-gray-700">{t(`consent.${k}Body`)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-gray-500">{t('consent.version', { version: NOTICE_VERSION })}</p>
    </Page>
  );
}
