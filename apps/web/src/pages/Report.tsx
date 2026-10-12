import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ErrorBox, Page, PRIMARY } from '../components/ui';
import { VerifyCard } from '../components/verify';
import { api, ApiError, postJson, type ReportView, type ShareRow } from '../lib/api';

const dateText = (iso: string, lang: string) =>
  new Date(iso).toLocaleDateString(lang === 'te' ? 'te-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function Report() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['report', id],
    queryFn: () => api<ReportView>(`/reports/${id}`),
    // The download link is signed for 10 minutes: keep it fresh while the screen is open.
    refetchInterval: 5 * 60_000,
  });
  const [copied, setCopied] = useState<'sha' | 'link' | null>(null);
  const [recipient, setRecipient] = useState('');
  const [days, setDays] = useState('30');

  const share = useMutation({
    mutationFn: () =>
      postJson<{ id: string; shareUrl: string; expiresAt: string }>(`/reports/${id}/shares`, {
        recipientName: recipient.trim(),
        expiresInDays: Math.max(1, Math.min(365, Math.floor(Number(days)) || 30)),
      }),
    onSuccess: () => {
      setRecipient('');
      void qc.invalidateQueries({ queryKey: ['report', id] });
    },
  });
  const revoke = useMutation({
    mutationFn: (shareId: string) => api(`/shares/${shareId}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['report', id] }),
  });

  const r = q.data;
  return (
    <Page
      action={
        r ? (
          <a className={PRIMARY} href={r.downloadUrl} target="_blank" rel="noopener noreferrer">
            {t('report.download')}
          </a>
        ) : undefined
      }
    >
      <h1 className="text-xl font-bold">{t('report.title')}</h1>
      {q.isLoading && <p>{t('common.loading')}</p>}
      {q.isError && (
        <ErrorBox>
          {q.error instanceof ApiError && q.error.status === 404
            ? t('report.notFound')
            : t('common.networkError')}
        </ErrorBox>
      )}
      {r && (
        <>
          <VerifyCard v={r} />

          <section className="space-y-2 rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="font-semibold">{t('report.sealTitle')}</h2>
            <p className="text-sm text-gray-700">{t('report.sealHelp')}</p>
            <button
              type="button"
              className="min-h-12 text-left"
              data-testid="sha-copy"
              onClick={async () => setCopied((await copy(r.sha256)) ? 'sha' : null)}
            >
              <span className="font-mono">{r.sha256.slice(0, 12)}</span>{' '}
              <span className="text-sm underline">
                {copied === 'sha' ? t('report.copied') : t('report.tapCopy')}
              </span>
            </button>
            <p className="text-sm">
              <Link className="underline" to={`/verify/${r.reportId}`}>
                {t('report.openVerify')}
              </Link>
            </p>
          </section>

          <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="font-semibold">{t('report.shareTitle')}</h2>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (recipient.trim()) share.mutate();
              }}
            >
              <label className="block text-sm">
                <span className="font-medium">{t('report.recipient')}</span>
                <input
                  className="mt-1 min-h-12 w-full rounded-lg border px-3 text-base"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">{t('report.expiryDays')}</span>
                <input
                  inputMode="numeric"
                  className="mt-1 min-h-12 w-full rounded-lg border px-3 text-base"
                  value={days}
                  onChange={(e) => setDays(e.target.value.replace(/[^\d]/g, ''))}
                />
              </label>
              <button
                type="submit"
                className="min-h-12 w-full rounded-xl border-2 border-emerald-700 font-semibold text-emerald-800 disabled:opacity-50"
                disabled={!recipient.trim() || share.isPending}
              >
                {t('report.makeLink')}
              </button>
            </form>
            {share.isError && <ErrorBox>{t('common.genericError')}</ErrorBox>}
            {share.data && (
              <div className="space-y-2 rounded-lg bg-emerald-50 p-3">
                <p className="text-sm font-medium">{t('report.linkReady')}</p>
                <p className="break-all font-mono text-xs" data-testid="share-url">
                  {share.data.shareUrl}
                </p>
                <button
                  type="button"
                  className="min-h-12 underline"
                  onClick={async () => setCopied((await copy(share.data.shareUrl)) ? 'link' : null)}
                >
                  {copied === 'link' ? t('report.copied') : t('report.copyLink')}
                </button>
              </div>
            )}
            {r.shares.length > 0 && (
              <ul className="divide-y rounded-lg border">
                {r.shares.map((s) => (
                  <ShareItem key={s.id} s={s} lang={lang} onRevoke={() => revoke.mutate(s.id)} />
                ))}
              </ul>
            )}
          </section>

          <p className="text-xs text-gray-500">{t('detail.lenderNote')}</p>
        </>
      )}
    </Page>
  );
}

function ShareItem({ s, lang, onRevoke }: { s: ShareRow; lang: string; onRevoke: () => void }) {
  const { t } = useTranslation();
  return (
    <li className="space-y-1 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{s.recipientName}</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
          {t(`report.status.${s.status}`)}
        </span>
      </div>
      <p className="text-gray-700">
        {t('report.viewsDownloads', { views: s.views, downloads: s.downloads })} ·{' '}
        {t('report.expires', { date: dateText(s.expiresAt, lang) })}
      </p>
      {s.status === 'active' && (
        <button type="button" className="min-h-10 text-red-700 underline" onClick={onRevoke}>
          {t('report.revoke')}
        </button>
      )}
    </li>
  );
}
