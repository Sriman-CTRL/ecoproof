import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { Icon } from '@phosphor-icons/react';
import { Database } from '@phosphor-icons/react/dist/csr/Database';
import { Question } from '@phosphor-icons/react/dist/csr/Question';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { Users } from '@phosphor-icons/react/dist/csr/Users';
import { Lock } from '@phosphor-icons/react/dist/csr/Lock';
import { Button } from '../components/kit/Button';
import { Card } from '../components/kit/Card';
import { ErrorBox, Page } from '../components/ui';
import { postJson } from '../lib/api';

export const NOTICE_VERSION = 'v1-demo';

const ROWS: Array<{ key: 'store' | 'why' | 'who' | 'delete'; icon: Icon }> = [
  { key: 'store', icon: Database },
  { key: 'why', icon: Question },
  { key: 'who', icon: Users },
  { key: 'delete', icon: Trash },
];

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

  return (
    <Page
      action={
        <Button disabled={agree.isPending} onClick={() => agree.mutate()}>
          {t('consent.agree')}
        </Button>
      }
    >
      <h1 className="font-heading text-title font-semibold">{t('consent.title')}</h1>
      <p className="text-ink-muted">{t('consent.intro')}</p>
      <p className="flex items-start gap-3 rounded-card bg-green-50 p-4 font-heading text-card-title font-semibold text-green-900">
        <Lock size={28} className="mt-px shrink-0 text-green-700" aria-hidden="true" />
        {t('consent.shared')}
      </p>
      {agree.isError && <ErrorBox>{t('consent.failed')}</ErrorBox>}
      <ul className="space-y-3">
        {ROWS.map(({ key, icon: IconCmp }) => (
          <li key={key}>
            <Card className="flex items-start gap-3">
              <IconCmp size={28} className="mt-px shrink-0 text-green-700" aria-hidden="true" />
              <div>
                <h2 className="text-card-title font-semibold">{t(`consent.${key}Title`)}</h2>
                <p className="text-ink-muted">{t(`consent.${key}Body`)}</p>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <p className="text-small text-ink-muted">
        {t('consent.version', { version: NOTICE_VERSION })}
      </p>
    </Page>
  );
}
