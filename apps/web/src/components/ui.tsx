import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowsLeftRight } from '@phosphor-icons/react/dist/csr/ArrowsLeftRight';
import { LANGUAGES } from '../i18n';
import { formatInr, inrWords } from '../lib/format';
import { getSession, setSession } from '../lib/session';
import { BUTTON_CLASS } from './kit/Button';
import { ErrorNote } from './kit/ErrorNote';
import { SourceChip } from './kit/SourceChip';
import { StickyPrimaryBar } from './kit/StickyPrimaryBar';

/** Kept for existing screens; the same look as the kit's primary Button. */
export const PRIMARY = BUTTON_CLASS.primary;

export function Header({ showBusiness = true }: { showBusiness?: boolean }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const session = getSession();
  return (
    <header className="flex min-h-14 items-center justify-between gap-2 bg-green-900 px-4 py-2 text-white">
      <div className="min-w-0">
        <Link to="/home" className="block font-heading text-card-title font-semibold">
          {showBusiness && session ? session.orgName : t('app.title')}
        </Link>
        {session && showBusiness && (
          <span className="mt-0.5 inline-block rounded-chip bg-copper-500 px-2 text-small font-semibold text-green-900">
            {t('common.sampleBadge')}
          </span>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <label className="sr-only" htmlFor="lang">
          {t('language.label')}
        </label>
        <select
          id="lang"
          className="min-h-12 rounded-button border border-green-200 bg-green-900 px-2 text-small text-white"
          value={i18n.resolvedLanguage}
          onChange={(e) => void i18n.changeLanguage(e.target.value)}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
        {session && (
          <button
            type="button"
            className="inline-flex min-h-12 items-center gap-1 rounded-button border border-green-200 px-2 text-small"
            onClick={() => {
              setSession(null);
              navigate('/start');
            }}
          >
            <ArrowsLeftRight size={18} aria-hidden="true" />
            {t('common.switchDemo')}
          </button>
        )}
      </div>
    </header>
  );
}

/** Mobile-first page: content scrolls, the single primary button sits at the bottom. */
export function Page({
  children,
  action,
  showBusiness,
}: {
  children: ReactNode;
  action?: ReactNode;
  showBusiness?: boolean;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col bg-paper">
      <Header showBusiness={showBusiness} />
      <main className="flex-1 space-y-3 p-4">{children}</main>
      {action && <StickyPrimaryBar>{action}</StickyPrimaryBar>}
    </div>
  );
}

/** Kept for existing screens: an ErrorNote with the message only. */
export function ErrorBox({ children }: { children: ReactNode }) {
  return <ErrorNote what={children} />;
}

/** Kept for existing screens: a SourceChip whose sheet shows the given source line. */
export function SourceNumber({
  children,
  source,
  className = '',
}: {
  children: ReactNode;
  source: string;
  className?: string;
}) {
  return (
    <SourceChip lineName={source} className={className}>
      {children}
    </SourceChip>
  );
}

/** Rupees with Indian grouping; amounts over Rs 1 lakh also get lakh/crore words. */
export function Rupees({ value }: { value: number }) {
  const words = inrWords(value);
  return (
    <span className="num">
      {formatInr(value)}
      {words && <span className="ml-1 text-[0.6em] font-normal text-ink-muted">({words})</span>}
    </span>
  );
}

export function monthLabel(iso: string, lang: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const locale = lang === 'te' ? 'te-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

/** "Cost pending: get a quote" when a cost range is not known (never an invented number). */
export function CostText({ low, high }: { low: number | null; high: number | null }) {
  const { t } = useTranslation();
  if (low == null || high == null) return <>{t('actions.costPending')}</>;
  if (low === 0 && high === 0) return <>{t('actions.costZero')}</>;
  return (
    <>
      {low === high ? (
        <Rupees value={low} />
      ) : (
        <>
          <Rupees value={low} /> - <Rupees value={high} />
        </>
      )}
    </>
  );
}
