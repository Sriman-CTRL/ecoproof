import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { List } from '@phosphor-icons/react/dist/csr/List';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { LANGUAGES } from '../../i18n';
import { getSession } from '../../lib/session';
import { Qr } from './Qr';

/** Public website shell (D6b): header nav, the one-paragraph story, footer. No login. */

/** Desktop max width 1200 px; 16 px side gutter on phones. */
export const WRAP = 'mx-auto w-full max-w-[1200px] px-4';
/** Below-the-fold sections are not rendered (so their fonts and images are not fetched) until near. */
export const DEFER = '[content-visibility:auto] [contain-intrinsic-size:auto_900px]';
export const LINK_BTN =
  'inline-flex min-h-12 items-center justify-center rounded-button px-4 font-semibold';

/** Paper grain: one inline SVG noise (about 300 bytes), flat green-900 underneath, no gradient. */
export const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .07 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>",
)}")`;

export const SITE_PAGES = [
  { to: '/how-it-works', key: 'how' },
  { to: '/carbon-method', key: 'method' },
  { to: '/for-lenders', key: 'lenders' },
  { to: '/for-buyers', key: 'buyers' },
  { to: '/for-homes', key: 'homes' },
  { to: '/about', key: 'about' },
] as const;

const SHORT_LANG: Record<string, string> = { en: 'EN', te: 'తె', hi: 'हि' };

export function SectionTitle({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-4 font-heading text-title font-semibold md:text-3xl">
      {children}
    </h2>
  );
}

/** A page band: alternating paper / surface backgrounds, same width everywhere. */
export function Band({
  children,
  tone = 'paper',
  id,
  defer = true,
  className = '',
}: {
  children: ReactNode;
  tone?: 'paper' | 'surface';
  id?: string;
  defer?: boolean;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-4 py-12 ${tone === 'paper' ? 'bg-paper' : 'bg-surface'} ${defer ? DEFER : ''}`}
    >
      <div className={`${WRAP} space-y-6 ${className}`}>{children}</div>
    </section>
  );
}

/** Title band for the inner pages: green, like the landing hero but shorter. */
export function PageHero({
  title,
  lead,
  aside,
}: {
  title: string;
  lead: string;
  aside?: ReactNode;
}) {
  return (
    <section className="bg-green-900 text-white" style={{ backgroundImage: GRAIN }}>
      <div className={`${WRAP} grid items-center gap-6 py-10 md:grid-cols-[3fr_2fr] md:py-14`}>
        <div className="space-y-4">
          <h1 className="font-heading text-hero font-semibold md:text-5xl md:leading-[3.25rem]">
            {title}
          </h1>
          <p className="max-w-2xl text-body text-green-200">{lead}</p>
        </div>
        {aside}
      </div>
    </section>
  );
}

function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  return (
    <div role="group" aria-label={t('language.label')} className="flex items-center">
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          lang={l.code}
          aria-pressed={i18n.resolvedLanguage === l.code}
          title={l.label}
          className={`min-h-12 min-w-11 px-2 text-small ${
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
  );
}

function NavLinks({ vertical = false }: { vertical?: boolean }) {
  const { t } = useTranslation();
  return (
    <ul className={vertical ? 'grid gap-1 py-2' : 'flex items-center gap-1'}>
      {SITE_PAGES.map((p) => (
        <li key={p.to}>
          <NavLink
            to={p.to}
            className={({ isActive }) =>
              `inline-flex min-h-12 items-center px-2 text-small ${
                isActive ? 'font-bold text-white underline underline-offset-4' : 'text-green-200'
              } hover:text-white`
            }
          >
            {t(`site.nav.${p.key}`)}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

function Header() {
  const { t } = useTranslation();
  const signedIn = getSession() != null;
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  return (
    <header className="bg-green-900 text-white">
      <div className={`${WRAP} flex min-h-14 items-center justify-between gap-x-3 py-1`}>
        <Link
          to="/"
          className="inline-flex min-h-12 items-center font-heading text-card-title font-semibold"
        >
          {t('app.title')}
        </Link>
        <nav aria-label={t('site.nav.label')} className="hidden lg:block">
          <NavLinks />
        </nav>
        <div className="flex items-center justify-end">
          <LanguageSwitch />
          {signedIn && (
            <Link
              to="/home"
              className="hidden min-h-12 items-center px-2 text-small underline underline-offset-4 sm:inline-flex"
            >
              {t('landing.nav.myApp')}
            </Link>
          )}
          <Link
            to="/start"
            className="hidden min-h-12 items-center rounded-button bg-copper-500 px-3 text-small font-semibold text-green-900 sm:inline-flex"
          >
            {t('landing.nav.trySample')}
          </Link>
          <button
            type="button"
            className="inline-flex min-h-12 min-w-12 items-center justify-center lg:hidden"
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={t('site.nav.menu')}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X size={24} aria-hidden="true" /> : <List size={24} aria-hidden="true" />}
          </button>
        </div>
      </div>
      {open && (
        <nav
          id="site-menu"
          aria-label={t('site.nav.label')}
          className={`${WRAP} border-t border-green-700 lg:hidden`}
        >
          <NavLinks vertical />
          <div className="flex flex-wrap gap-3 pb-4">
            <Link to="/start" className={`${LINK_BTN} bg-copper-500 text-green-900`}>
              {t('landing.nav.trySample')}
            </Link>
            {signedIn && (
              <Link to="/home" className={`${LINK_BTN} border border-green-200`}>
                {t('landing.nav.myApp')}
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

/** The story every page tells (D6b), in one paragraph above the footer. */
function Story() {
  const { t } = useTranslation();
  return (
    <section className={`border-t bg-green-50 py-10 ${DEFER}`} data-testid="site-story">
      <div className={`${WRAP} grid gap-4 md:grid-cols-[1fr_3fr] md:items-start`}>
        <h2 className="font-heading text-card-title font-semibold text-green-700">
          {t('site.story.title')}
        </h2>
        <p className="text-body">{t('site.story.body')}</p>
      </div>
    </section>
  );
}

function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="bg-green-900 text-green-200" style={{ backgroundImage: GRAIN }}>
      <div className={`${WRAP} grid gap-8 py-10 text-small md:grid-cols-[2fr_2fr_auto]`}>
        <div className="space-y-1">
          <p className="font-heading text-card-title font-semibold text-white">{t('app.title')}</p>
          <p className="font-semibold text-white">{t('landing.footer.sdg')}</p>
          <p>{t('site.footer.team')}</p>
          <p>{t('landing.footer.proto')}</p>
          <p className="font-semibold text-copper-500">{t('site.footer.synthetic')}</p>
          <p>{t('landing.footer.note')}</p>
        </div>
        <nav aria-label={t('site.footer.links')}>
          <ul className="grid grid-cols-2 gap-x-4">
            <li>
              <Link to="/" className="inline-flex min-h-12 items-center hover:text-white">
                {t('site.nav.home')}
              </Link>
            </li>
            {SITE_PAGES.map((p) => (
              <li key={p.to}>
                <Link to={p.to} className="inline-flex min-h-12 items-center hover:text-white">
                  {t(`site.nav.${p.key}`)}
                </Link>
              </li>
            ))}
            <li>
              <Link
                to="/start"
                className="inline-flex min-h-12 items-center font-semibold text-copper-500"
              >
                {t('landing.nav.trySample')}
              </Link>
            </li>
          </ul>
        </nav>
        {/* Desktop only: a judge scans it from the projected screen to open the live site. */}
        <div data-testid="footer-qr" className="hidden flex-col items-center gap-2 md:flex">
          <Qr url={window.location.origin} alt={t('landing.footer.qrAlt')} />
          <p className="max-w-44 text-center">{t('landing.footer.qr')}</p>
        </div>
      </div>
    </footer>
  );
}

export function PublicLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <main>{children}</main>
      <Story />
      <Footer />
    </div>
  );
}
