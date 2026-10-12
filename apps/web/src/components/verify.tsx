import { useState, type ChangeEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FileMagnifyingGlass } from '@phosphor-icons/react/dist/csr/FileMagnifyingGlass';
import type { VerifyView } from '../lib/api';
import { formatInr } from '../lib/format';
import { BUTTON_CLASS } from './kit/Button';
import { PaperSheet } from './kit/PaperSheet';
import { SkeletonBlock } from './kit/Skeleton';
import { SourceChip } from './kit/SourceChip';
import { StampBadge } from './kit/StampBadge';
import { Rupees } from './ui';

/** SHA-256 of a file, computed in the browser (Web Crypto); the file never leaves the device. */
export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const dateText = (iso: string, lang: string) =>
  new Date(iso).toLocaleDateString(lang === 'te' ? 'te-IN' : 'en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

export type CheckResult = 'match' | 'mismatch' | null;

/** Compares a chosen PDF's SHA-256 with the seal recorded at issue. */
export function useHashCheck(expected: string | undefined) {
  const [result, setResult] = useState<CheckResult>(null);
  const [busy, setBusy] = useState(false);
  async function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !expected) return;
    setBusy(true);
    setResult(null);
    try {
      setResult((await sha256Hex(file)) === expected ? 'match' : 'mismatch');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }
  return { result, busy, onChange };
}

/** "Check a PDF file": a label that opens the file picker; the input stays hidden. */
export function CheckFileButton({
  variant,
  onChange,
  busy,
}: {
  variant: 'primary' | 'secondary';
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  return (
    <label className={`${BUTTON_CLASS[variant]} cursor-pointer`}>
      <FileMagnifyingGlass size={24} aria-hidden="true" />
      {busy ? t('verify.checking') : t('verify.checkFile')}
      <input
        type="file"
        accept="application/pdf"
        data-testid="verify-file"
        className="sr-only"
        onChange={onChange}
      />
    </label>
  );
}

/** The big answer: genuine in green with a stamp, or "does not match" in loss red. */
export function VerifyHeadline({ result }: { result: CheckResult }) {
  const { t } = useTranslation();
  const bad = result === 'mismatch';
  return (
    <section
      role="status"
      className={`space-y-3 rounded-card p-5 text-center ${bad ? 'bg-loss-50' : 'bg-green-50'}`}
    >
      <StampBadge key={result ?? 'none'} variant={bad ? 'mismatch' : 'genuine'} press />
      <h1
        className={`font-heading text-title font-semibold ${bad ? 'text-loss' : 'text-green-900'}`}
      >
        {t(bad ? 'verify.noMatch' : 'verify.genuine')}
      </h1>
      <p className={bad ? 'text-ink' : 'text-ink-muted'}>
        {t(
          bad
            ? 'verify.noMatchHelp'
            : result === 'match'
              ? 'verify.matchHelp'
              : 'verify.genuineHelp',
        )}
      </p>
    </section>
  );
}

/** Report ID, issue date, business name and headline figures: nothing else (Doc 05). */
export function VerifyCard({ v, sourced = false }: { v: VerifyView; sourced?: boolean }) {
  const { t, i18n } = useTranslation();
  const h = v.headline;
  const fig = (text: ReactNode) =>
    sourced ? <SourceChip lineName={h.measure}>{text}</SourceChip> : <>{text}</>;
  const range =
    h.monthlySavingLow === h.monthlySavingHigh
      ? formatInr(Math.round(h.monthlySavingLow))
      : `${formatInr(Math.round(h.monthlySavingLow))} - ${formatInr(Math.round(h.monthlySavingHigh))}`;
  return (
    <PaperSheet className="space-y-3">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-small">
        <dt className="text-ink-muted">{t('verify.business')}</dt>
        <dd className="font-semibold">{v.businessName}</dd>
        <dt className="text-ink-muted">{t('verify.reportId')}</dt>
        <dd className="font-mono break-all">{v.reportId}</dd>
        <dt className="text-ink-muted">{t('verify.issued')}</dt>
        <dd>
          {dateText(v.issuedAt, i18n.resolvedLanguage ?? 'en')} ·{' '}
          {t('verify.version', { n: v.version })}
        </dd>
      </dl>
      <div className="space-y-1 border-t pt-3">
        <p className="font-heading text-card-title font-semibold">{h.measure}</p>
        <p>
          {t('verify.saving')}: <b className="num">{fig(range)}</b> {t('health.perMonth')}
        </p>
        <p>
          {t('detail.emi')}: <b className="num">{fig(formatInr(h.emi))}</b>
        </p>
        <p>
          {t('verify.net')}:{' '}
          <b className="num text-card-title">{fig(<Rupees value={h.netMonthly} />)}</b>{' '}
          {t('health.perMonth')}
        </p>
      </div>
    </PaperSheet>
  );
}

/** What was compared: the seal code, and the privacy line. */
export function SealNote({ expected }: { expected: string }) {
  const { t } = useTranslation();
  return (
    <section className="space-y-1">
      <p className="text-small text-ink-muted">{t('verify.privacy')}</p>
      <p className="font-mono text-small break-all text-ink-muted">SHA-256: {expected}</p>
    </section>
  );
}

export function VerifySkeleton() {
  return (
    <div role="status" aria-busy="true" className="space-y-3">
      <SkeletonBlock className="h-40 w-full" />
      <SkeletonBlock className="h-48 w-full" />
    </div>
  );
}
