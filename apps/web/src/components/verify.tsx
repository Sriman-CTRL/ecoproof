import { useState, type ChangeEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FileMagnifyingGlass } from '@phosphor-icons/react/dist/csr/FileMagnifyingGlass';
import type { CarbonHeadline, CbamHeadline, LoanPackHeadline, VerifyView } from '../lib/api';
import { formatDecimal, formatInr, formatNumber, formatRate } from '../lib/format';
import { BUTTON_CLASS } from './kit/Button';
import { PaperSheet } from './kit/PaperSheet';
import { SkeletonBlock } from './kit/Skeleton';
import { SourceChip } from './kit/SourceChip';
import { StampBadge } from './kit/StampBadge';
import { monthLabel, Rupees } from './ui';

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
      {v.headline.kind === 'cbam_sheet' ? (
        <CbamLines h={v.headline} />
      ) : v.headline.kind === 'carbon_statement' ? (
        <CarbonLines h={v.headline} />
      ) : (
        <LoanLines h={v.headline} sourced={sourced} />
      )}
    </PaperSheet>
  );
}

function LoanLines({ h, sourced }: { h: LoanPackHeadline; sourced: boolean }) {
  const { t } = useTranslation();
  const fig = (text: ReactNode) =>
    sourced ? <SourceChip lineName={h.measure}>{text}</SourceChip> : <>{text}</>;
  const range =
    h.monthlySavingLow === h.monthlySavingHigh
      ? formatInr(Math.round(h.monthlySavingLow))
      : `${formatInr(Math.round(h.monthlySavingLow))} - ${formatInr(Math.round(h.monthlySavingHigh))}`;
  return (
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
  );
}

/** Carbon footprint statement: footprint, intensity and CO2 avoided (stamped only when verified). */
function CarbonLines({ h }: { h: CarbonHeadline }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const one = (n: number) => formatDecimal(Math.round(n * 10) / 10);
  return (
    <div className="space-y-1 border-t pt-3" data-testid="verify-carbon">
      <p className="font-heading text-card-title font-semibold">{t('carbon.statementTitle')}</p>
      <p className="text-small text-ink-muted">
        {t('verify.carbonPeriod', {
          from: monthLabel(h.period.from, lang),
          to: monthLabel(h.period.to, lang),
        })}
      </p>
      <p>
        {t('verify.footprint')} ({monthLabel(h.month, lang)}):{' '}
        <b className="num text-card-title">
          {one(h.totalT)} {t('carbon.unit')}
        </b>
      </p>
      <p className="num text-small">
        {h.scope1T > 0
          ? t('carbon.split', { grid: one(h.scope2T), diesel: one(h.scope1T) })
          : t('carbon.splitGridOnly', { grid: one(h.scope2T) })}
      </p>
      {h.intensity != null && (
        <p className="num text-small">
          {t('carbon.intensity', { value: formatRate(h.intensity) })}
        </p>
      )}
      {h.avoidedT != null && (
        <div className="space-y-1 pt-1">
          {h.avoidedVerified ? (
            <StampBadge variant="verified" />
          ) : (
            <p className="text-small font-semibold">{t('carbon.calculated')}</p>
          )}
          <p className="num font-semibold">{t('carbon.avoided', { value: one(h.avoidedT) })}</p>
        </div>
      )}
    </div>
  );
}

/** CBAM sheet: products and direct t CO2e per t only, always under the estimate stamp (Doc 05). */
function CbamLines({ h }: { h: CbamHeadline }) {
  const { t, i18n } = useTranslation();
  const month = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(
      i18n.resolvedLanguage === 'te' ? 'te-IN' : 'en-IN',
      { month: 'short', year: 'numeric', timeZone: 'UTC' },
    );
  return (
    <div className="space-y-2 border-t pt-3">
      <p className="font-heading text-card-title font-semibold">{t('cbam.title')}</p>
      <StampBadge variant="estimate" />
      <p className="text-small text-ink-muted">
        {t('cbam.period', { from: month(h.period.from), to: month(h.period.to) })}
      </p>
      <ul className="space-y-1">
        {h.products.map((p) => (
          <li key={`${p.cnCode}-${p.description}`}>
            <span className="font-mono font-semibold">{p.cnCode}</span> · {p.description} ·{' '}
            <span className="num">{t('cbam.tonnesShort', { t: formatNumber(p.tonnes) })}</span>
            <br />
            <span className="text-small">
              {p.inScopeNow
                ? t('cbam.seeLine', { value: formatDecimal(p.seeDirect) })
                : t('cbam.notInScope')}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-small text-ink-muted">{t('cbam.directOnly')}</p>
    </div>
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

/** The status line under a report: CBAM estimate, carbon method note, or the lender line. */
export const noteKey = (type: string) =>
  type === 'cbam_sheet'
    ? 'cbam.statusNote'
    : type === 'carbon_statement'
      ? 'report.carbonNote'
      : 'detail.lenderNote';
