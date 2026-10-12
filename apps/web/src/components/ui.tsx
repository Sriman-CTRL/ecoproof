import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { LANGUAGES } from '../i18n';
import { formatInr, inrWords } from '../lib/format';
import { getSession, setSession } from '../lib/session';

export const PRIMARY =
  'flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-base font-semibold text-white active:bg-emerald-800 disabled:bg-gray-300 disabled:text-gray-500';

export function Header({ showBusiness = true }: { showBusiness?: boolean }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const session = getSession();
  return (
    <header className="flex items-center justify-between gap-2 border-b bg-white px-4 py-3">
      <div className="min-w-0">
        <Link to="/home" className="block text-base font-bold leading-tight">
          {showBusiness && session ? session.orgName : t('app.title')}
        </Link>
        {session && showBusiness && (
          <span className="mt-0.5 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
            {t('common.sampleBadge')}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <label className="sr-only" htmlFor="lang">
          {t('language.label')}
        </label>
        <select
          id="lang"
          className="min-h-10 rounded-lg border px-2 text-sm"
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
            className="min-h-10 rounded-lg border px-2 text-sm"
            onClick={() => {
              setSession(null);
              navigate('/start');
            }}
          >
            ⇄ {t('common.switchDemo')}
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
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col bg-gray-50">
      <Header showBusiness={showBusiness} />
      <main className="flex-1 space-y-4 p-4">{children}</main>
      {action && (
        <div className="sticky bottom-0 border-t bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {action}
        </div>
      )}
    </div>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800"
    >
      {children}
    </div>
  );
}

/** A number that can be tapped to see where it comes from (principle 4). */
export function SourceNumber({
  children,
  source,
  className = '',
}: {
  children: ReactNode;
  source: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        className={`text-left underline decoration-dotted underline-offset-4 ${className}`}
        aria-expanded={open}
        title={t('common.tapSource')}
        onClick={() => setOpen((o) => !o)}
      >
        {children}
      </button>
      {open && <span className="mt-1 text-xs font-normal text-gray-600">{source}</span>}
    </span>
  );
}

/** Rupees with Indian grouping; amounts over Rs 1 lakh also get lakh/crore words. */
export function Rupees({ value }: { value: number }) {
  const words = inrWords(value);
  return (
    <>
      {formatInr(value)}
      {words && <span className="ml-1 text-[0.6em] font-normal text-gray-600">({words})</span>}
    </>
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
