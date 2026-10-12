import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { XCircle } from '@phosphor-icons/react/dist/csr/XCircle';
import type { VerifyView } from '../lib/api';
import { formatInr } from '../lib/format';
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

/** Report ID, issue date, business name and headline figures: nothing else (Doc 05). */
export function VerifyCard({ v }: { v: VerifyView }) {
  const { t, i18n } = useTranslation();
  const h = v.headline;
  const range =
    h.monthlySavingLow === h.monthlySavingHigh
      ? formatInr(Math.round(h.monthlySavingLow))
      : `${formatInr(Math.round(h.monthlySavingLow))} - ${formatInr(Math.round(h.monthlySavingHigh))}`;
  return (
    <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-gray-600">{t('verify.business')}</dt>
        <dd className="font-semibold">{v.businessName}</dd>
        <dt className="text-gray-600">{t('verify.reportId')}</dt>
        <dd className="break-all font-mono text-xs">{v.reportId}</dd>
        <dt className="text-gray-600">{t('verify.issued')}</dt>
        <dd>
          {dateText(v.issuedAt, i18n.resolvedLanguage ?? 'en')} ·{' '}
          {t('verify.version', { n: v.version })}
        </dd>
      </dl>
      <div className="space-y-1 border-t pt-3">
        <p className="font-semibold">{h.measure}</p>
        <p>
          {t('verify.saving')}: <b>{range}</b> {t('health.perMonth')}
        </p>
        <p>
          {t('detail.emi')}: <b>{formatInr(h.emi)}</b>
        </p>
        <p>
          {t('verify.net')}:{' '}
          <b className="text-lg">
            <Rupees value={h.netMonthly} />
          </b>{' '}
          {t('health.perMonth')}
        </p>
      </div>
    </section>
  );
}

/** "Check a PDF": compares the file's SHA-256 with the seal recorded at issue. */
export function HashCheck({ expected }: { expected: string }) {
  const { t } = useTranslation();
  const [result, setResult] = useState<'match' | 'mismatch' | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="font-semibold">{t('verify.checkTitle')}</h2>
      <p className="text-sm text-gray-700">{t('verify.checkHelp')}</p>
      <input
        type="file"
        accept="application/pdf"
        data-testid="verify-file"
        className="block min-h-12 w-full text-sm"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          setResult(null);
          try {
            setResult((await sha256Hex(file)) === expected ? 'match' : 'mismatch');
          } finally {
            setBusy(false);
          }
        }}
      />
      {busy && <p>{t('common.loading')}</p>}
      {result === 'match' && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-card bg-green-50 p-3 font-semibold text-green-700"
        >
          <CheckCircle size={22} className="shrink-0" aria-hidden="true" />
          {t('verify.match')}
        </p>
      )}
      {result === 'mismatch' && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-card bg-loss-50 p-3 font-semibold text-loss"
        >
          <XCircle size={22} className="shrink-0" aria-hidden="true" />
          {t('verify.mismatch')}
        </p>
      )}
      <p className="break-all font-mono text-xs text-gray-500">SHA-256: {expected}</p>
    </section>
  );
}
