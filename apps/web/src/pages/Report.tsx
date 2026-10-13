import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Copy } from '@phosphor-icons/react/dist/csr/Copy';
import { DownloadSimple } from '@phosphor-icons/react/dist/csr/DownloadSimple';
import { BUTTON_CLASS, Button } from '../components/kit/Button';
import { Card } from '../components/kit/Card';
import { Skeleton } from '../components/kit/Skeleton';
import { StatusPill, type PillTone } from '../components/kit/StatusPill';
import { LoanPackExplainer } from '../components/LoanPackExplainer';
import { ErrorBox, Page } from '../components/ui';
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

const SHARE_TONE: Record<ShareRow['status'], PillTone> = {
  active: 'positive',
  expired: 'neutral',
  revoked: 'loss',
};

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
  const recipientRef = useRef<HTMLInputElement>(null);

  const share = useMutation({
    mutationFn: () =>
      postJson<{ id: string; shareUrl: string; expiresAt: string }>(`/reports/${id}/shares`, {
        recipientName: recipient.trim(),
        expiresInDays: Math.max(1, Math.min(365, Math.floor(Number(days)) || 30)),
      }),
    onSuccess: () => {
      setRecipient('');
      void qc.invalidateQueries({ queryKey: ['report', id] });
      void qc.invalidateQueries({ queryKey: ['progress'] });
    },
  });
  const revoke = useMutation({
    mutationFn: (shareId: string) => api(`/shares/${shareId}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['report', id] }),
  });

  /** One button: with a recipient it makes the link, without one it takes you to the name field. */
  function shareWithLender() {
    if (recipient.trim()) share.mutate();
    else {
      recipientRef.current?.scrollIntoView({ block: 'center' });
      recipientRef.current?.focus();
    }
  }

  const inputClass = 'mt-1 min-h-12 w-full rounded-button border bg-surface px-3 text-body';
  const r = q.data;
  const isCbam = r?.type === 'cbam_sheet';
  const isCarbon = r?.type === 'carbon_statement';
  const isLoan = r != null && !isCbam && !isCarbon;
  return (
    <Page
      tab="reports"
      action={
        r ? (
          <Button disabled={share.isPending} onClick={shareWithLender}>
            {t(
              isCbam
                ? 'report.shareWithBuyer'
                : isCarbon
                  ? 'report.shareCarbon'
                  : 'report.shareWithLender',
            )}
          </Button>
        ) : undefined
      }
    >
      <h1 className="font-heading text-title font-semibold">
        {t(isCbam ? 'cbam.title' : isCarbon ? 'carbon.statementTitle' : 'report.title')}
      </h1>
      {q.isLoading && (
        <>
          <Skeleton />
          <Skeleton />
        </>
      )}
      {q.isError && (
        <ErrorBox>
          {q.error instanceof ApiError && q.error.status === 404
            ? t('report.notFound')
            : t('common.networkError')}
        </ErrorBox>
      )}
      {r && (
        <>
          <div className="grid gap-3 lg:grid-cols-12 lg:items-start lg:gap-6">
            {isLoan && (
              <div className="lg:col-span-7">
                <LoanPackExplainer reportId={r.reportId} />
              </div>
            )}
            <div className={`space-y-3 ${isLoan ? 'lg:col-span-5' : 'lg:col-span-12'}`}>
              {isLoan && (
                <p className="hidden text-small font-semibold text-ink-muted lg:block">
                  {t('report.preview')}
                </p>
              )}
              <VerifyCard v={r} sourced />
              <a
                className={`${BUTTON_CLASS.secondary} w-full`}
                href={r.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <DownloadSimple size={20} aria-hidden="true" />
                {t(isCbam ? 'report.downloadExcel' : 'report.download')}
              </a>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2 lg:items-start lg:gap-6">
            <Card className="space-y-2">
              <h2 className="font-heading text-card-title font-semibold">
                {t('report.sealTitle')}
              </h2>
              <p className="text-small text-ink-muted">
                {t(isCbam ? 'report.sealHelpFile' : 'report.sealHelp')}
              </p>
              <button
                type="button"
                className="flex min-h-12 items-center gap-2 text-left"
                data-testid="sha-copy"
                onClick={async () => setCopied((await copy(r.sha256)) ? 'sha' : null)}
              >
                <span className="font-mono">{r.sha256.slice(0, 12)}</span>
                <Copy size={20} className="text-green-700" aria-hidden="true" />
                <span className="text-small text-green-700 underline">
                  {copied === 'sha' ? t('report.copied') : t('report.tapCopy')}
                </span>
              </button>
              <Link className={`${BUTTON_CLASS.secondary} w-full`} to={`/verify/${r.reportId}`}>
                {t('report.openVerify')}
              </Link>
            </Card>

            <Card className="space-y-3">
              <h2 className="font-heading text-card-title font-semibold">
                {t(
                  isCbam
                    ? 'report.shareTitleBuyer'
                    : isCarbon
                      ? 'report.shareCarbon'
                      : 'report.shareTitle',
                )}
              </h2>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  shareWithLender();
                }}
              >
                <label className="block text-small">
                  <span className="font-semibold">{t('report.recipient')}</span>
                  <input
                    ref={recipientRef}
                    className={inputClass}
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                  />
                </label>
                <label className="block text-small">
                  <span className="font-semibold">{t('report.expiryDays')}</span>
                  <input
                    inputMode="numeric"
                    className={inputClass}
                    value={days}
                    onChange={(e) => setDays(e.target.value.replace(/[^\d]/g, ''))}
                  />
                </label>
              </form>
              {share.isError && <ErrorBox>{t('common.genericError')}</ErrorBox>}
              {share.data && (
                <div className="space-y-2 rounded-card bg-green-50 p-3">
                  <p className="text-small font-semibold">{t('report.linkReady')}</p>
                  <p className="font-mono text-small break-all" data-testid="share-url">
                    {share.data.shareUrl}
                  </p>
                  <Button
                    variant="secondary"
                    onClick={async () =>
                      setCopied((await copy(share.data.shareUrl)) ? 'link' : null)
                    }
                  >
                    <Copy size={20} aria-hidden="true" />
                    {copied === 'link' ? t('report.copied') : t('report.copyLink')}
                  </Button>
                </div>
              )}
            </Card>
          </div>

          <section className="space-y-2">
            <h2 className="font-heading text-card-title font-semibold">{t('report.log')}</h2>
            {r.shares.length === 0 ? (
              <p className="text-ink-muted">{t('report.noShares')}</p>
            ) : (
              <Card className="py-1">
                <ul>
                  {r.shares.map((s) => (
                    <ShareItem key={s.id} s={s} lang={lang} onRevoke={() => revoke.mutate(s.id)} />
                  ))}
                </ul>
              </Card>
            )}
          </section>

          <p className="text-small text-ink-muted">
            {t(isCbam ? 'cbam.statusNote' : isCarbon ? 'report.carbonNote' : 'detail.lenderNote')}
          </p>
        </>
      )}
    </Page>
  );
}

function ShareItem({ s, lang, onRevoke }: { s: ShareRow; lang: string; onRevoke: () => void }) {
  const { t } = useTranslation();
  return (
    <li className="space-y-1 border-b py-3 text-small last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{s.recipientName}</span>
        <StatusPill tone={SHARE_TONE[s.status]}>{t(`report.status.${s.status}`)}</StatusPill>
      </div>
      <p className="num text-ink-muted">
        {t('report.viewsDownloads', { views: s.views, downloads: s.downloads })} ·{' '}
        {t('report.expires', { date: dateText(s.expiresAt, lang) })}
      </p>
      {s.status === 'active' && (
        <Button variant="danger" onClick={onRevoke}>
          {t('report.revoke')}
        </Button>
      )}
    </li>
  );
}
