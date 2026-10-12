import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowsLeftRight } from '@phosphor-icons/react/dist/csr/ArrowsLeftRight';
import { Files } from '@phosphor-icons/react/dist/csr/Files';
import { House } from '@phosphor-icons/react/dist/csr/House';
import { ListChecks } from '@phosphor-icons/react/dist/csr/ListChecks';
import { Receipt } from '@phosphor-icons/react/dist/csr/Receipt';
import { Sun } from '@phosphor-icons/react/dist/csr/Sun';
import type { Icon } from '@phosphor-icons/react';
import { LANGUAGES } from '../i18n';
import { formatInr, inrWords } from '../lib/format';
import { getSession, isHousehold, setSession } from '../lib/session';
import { BUTTON_CLASS } from './kit/Button';
import { ErrorNote } from './kit/ErrorNote';
import { SourceChip } from './kit/SourceChip';
import { StickyPrimaryBar } from './kit/StickyPrimaryBar';
import type { YearMonth } from './kit/YearStrip';

/** Kept for existing screens; the same look as the kit's primary Button. */
export const PRIMARY = BUTTON_CLASS.primary;

const SHORT_LANG: Record<string, string> = { en: 'EN', te: 'తె', hi: 'हि' };
const FULL_WIDTH = 'mx-auto w-full max-w-[480px]';
const WIDE = 'mx-auto w-full max-w-5xl';

export function Header({
  showBusiness = true,
  wide = false,
}: {
  showBusiness?: boolean;
  wide?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const session = getSession();
  return (
    <header className="bg-green-900 text-white">
      <div
        className={`${wide ? WIDE : FULL_WIDTH} flex min-h-14 items-center justify-between gap-2 px-4 py-1`}
      >
        <div className="min-w-0">
          <Link
            to="/home"
            // Header stays 56px tall; the ::before overlay makes the tap target 48px.
            data-hit-area="48"
            className="relative block font-heading text-card-title font-semibold before:absolute before:-inset-y-2 before:inset-x-0 before:content-['']"
          >
            {t('app.title')}
          </Link>
          {session && showBusiness && (
            <div className="flex flex-wrap items-center gap-x-2">
              <span className="text-small">{session.orgName}</span>
              <span className="rounded-chip bg-copper-500 px-2 text-small font-semibold text-green-900">
                {t('common.sampleBadge')}
              </span>
            </div>
          )}
        </div>
        <div
          role="group"
          aria-label={t('language.label')}
          className="flex shrink-0 items-center justify-end"
        >
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              lang={l.code}
              aria-pressed={i18n.resolvedLanguage === l.code}
              title={l.label}
              className={`min-h-12 min-w-12 px-2 text-small ${
                i18n.resolvedLanguage === l.code
                  ? 'font-bold text-copper-500 underline underline-offset-4'
                  : 'text-green-200'
              }`}
              onClick={() => void i18n.changeLanguage(l.code)}
            >
              {SHORT_LANG[l.code]}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

/** Back to the sample chooser; lives at the bottom of Home because Settings is out of scope. */
export function SwitchSample() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className={`${BUTTON_CLASS.secondary} w-full`}
      onClick={() => {
        setSession(null);
        navigate('/start');
      }}
    >
      <ArrowsLeftRight size={18} aria-hidden="true" />
      {t('common.switchDemo')}
    </button>
  );
}

export type TabId = 'home' | 'bills' | 'plan' | 'reports' | 'solar';
const TABS: Array<{ id: TabId; to: string; icon: Icon; key: string }> = [
  { id: 'home', to: '/home', icon: House, key: 'nav.home' },
  { id: 'bills', to: '/bills', icon: Receipt, key: 'nav.bills' },
  { id: 'plan', to: '/actions', icon: ListChecks, key: 'nav.plan' },
  { id: 'reports', to: '/reports', icon: Files, key: 'nav.reports' },
];
/** Households have no plan or reports (HH-1): Home, Bills, Solar. */
const HOUSEHOLD_TABS: typeof TABS = [
  TABS[0]!,
  TABS[1]!,
  { id: 'solar', to: '/household/solar', icon: Sun, key: 'nav.solar' },
];

/** 64px white bar, icon + word. Hidden on the capture flow and on public pages. */
export function TabBar({ active, wide }: { active: TabId; wide: boolean }) {
  const { t } = useTranslation();
  const tabs = isHousehold() ? HOUSEHOLD_TABS : TABS;
  return (
    <nav
      aria-label={t('nav.label')}
      className="sticky bottom-0 z-20 h-16 border-t bg-surface pb-[env(safe-area-inset-bottom)] box-content"
    >
      <ul
        className={`${wide ? WIDE : FULL_WIDTH} grid h-16 ${tabs.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}
      >
        {tabs.map(({ id, to, icon: IconCmp, key }) => (
          <li key={id}>
            <Link
              to={to}
              aria-current={active === id ? 'page' : undefined}
              className={`flex h-16 flex-col items-center justify-center gap-0.5 text-small ${
                active === id ? 'font-semibold text-green-700' : 'text-ink-muted'
              }`}
            >
              <IconCmp size={24} weight={active === id ? 'fill' : 'regular'} aria-hidden="true" />
              {t(key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Mobile-first page: content scrolls, the single primary button sits above the tab bar. */
export function Page({
  children,
  action,
  showBusiness,
  tab,
  wide = false,
  isPublic = false,
}: {
  children: ReactNode;
  action?: ReactNode;
  showBusiness?: boolean;
  /** Shows the bottom tab bar with this tab marked; leave out to hide it. */
  tab?: TabId;
  /** Two columns at 1024px and up (confirm screen). */
  wide?: boolean;
  /** Public pages show no business name, no tab bar. */
  isPublic?: boolean;
}) {
  const tabs = tab && !isPublic ? tab : undefined;
  return (
    <div
      className="flex min-h-dvh flex-col bg-paper"
      style={tabs ? ({ '--tabbar-h': '64px' } as React.CSSProperties) : undefined}
    >
      <Header showBusiness={isPublic ? false : showBusiness} wide={wide} />
      <main className={`${wide ? WIDE : FULL_WIDTH} flex-1 space-y-3 p-4`}>{children}</main>
      {action && (
        <StickyPrimaryBar>
          <div className={wide ? WIDE : FULL_WIDTH}>{action}</div>
        </StickyPrimaryBar>
      )}
      {tabs && <TabBar active={tabs} wide={wide} />}
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

/** The last 12 calendar months up to the newest bill; a tile is filled when that month has a bill. */
export function yearMonths(
  months: Array<{ month: string }>,
  lang: string,
  /** The monthly ritual's month (YYYY-MM): may be a bill read but not yet confirmed. */
  ritual?: { month: string; done: boolean } | null,
): YearMonth[] {
  if (months.length === 0 && !ritual) return [];
  const have = new Set(months.map((m) => m.month.slice(0, 7)));
  const newest = [...months.map((m) => m.month.slice(0, 7)), ritual?.month ?? ''].sort().at(-1)!;
  const y = Number(newest.slice(0, 4));
  const m = Number(newest.slice(5, 7)) - 1;
  const locale = lang === 'te' ? 'te-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 11 + i, 1));
    const key = d.toISOString().slice(0, 7);
    return {
      label: new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(d),
      confirmed: have.has(key),
      ...(ritual?.month === key ? { ritual: { done: ritual.done } } : {}),
    };
  });
}
