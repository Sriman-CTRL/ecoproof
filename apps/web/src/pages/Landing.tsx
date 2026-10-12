import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { cashTest, emi } from '@ecoproof/calc';
import { EmiVsSavingBar } from '../components/kit/EmiVsSavingBar';
import { StampBadge } from '../components/kit/StampBadge';
import { YearStrip } from '../components/kit/YearStrip';
import { LANGUAGES } from '../i18n';
import { loadFullFonts, loadScriptFonts } from '../i18n/fonts';
import { formatInr } from '../lib/format';
import { getSession } from '../lib/session';

/** Landing page (plan section 5). Public: no login, no consent gate, no tab bar. */

const DEMO_REPORT_ID =
  (import.meta.env.VITE_DEMO_REPORT_ID as string | undefined) ??
  '5d3a0a10-0000-4000-8000-0000000000c1';

const SHORT_LANG: Record<string, string> = { en: 'EN', te: 'తె', hi: 'हि' };
const WRAP = 'mx-auto w-full max-w-5xl px-4';
/** Below-the-fold sections are not rendered (so their fonts and images are not fetched) until near. */
const DEFER = '[content-visibility:auto] [contain-intrinsic-size:auto_900px]';
const LINK_BTN =
  'inline-flex min-h-12 items-center justify-center rounded-button px-4 font-semibold';

/** Paper grain: one inline SVG noise (about 300 bytes), flat green-900 underneath, no gradient. */
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .07 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>",
)}")`;

function Header() {
  const { t, i18n } = useTranslation();
  const signedIn = getSession() != null;
  return (
    <header className="bg-green-900 text-white">
      <div className={`${WRAP} flex min-h-14 flex-wrap items-center justify-between gap-x-3 py-1`}>
        <span className="font-heading text-card-title font-semibold">{t('app.title')}</span>
        <div className="flex flex-wrap items-center justify-end">
          <div role="group" aria-label={t('language.label')} className="flex items-center">
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
          {signedIn && (
            <Link
              to="/home"
              className="inline-flex min-h-12 items-center px-2 text-small underline underline-offset-4"
            >
              {t('landing.nav.myApp')}
            </Link>
          )}
          <Link
            to="/start"
            className="inline-flex min-h-12 items-center px-2 text-small font-semibold text-copper-500 underline underline-offset-4"
          >
            {t('landing.nav.trySample')}
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const { t } = useTranslation();
  return (
    <section className="bg-green-900 text-white" style={{ backgroundImage: GRAIN }}>
      <div className={`${WRAP} grid items-center gap-8 py-10 md:grid-cols-2 md:py-16`}>
        <div className="space-y-5">
          <h1 className="font-heading text-hero font-semibold md:text-5xl md:leading-[3.25rem]">
            {t('landing.hero.title')}
          </h1>
          <p className="text-body text-green-200">{t('landing.hero.sub')}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to="/start"
              className={`${LINK_BTN} min-h-13 bg-copper-500 text-green-900 shadow-card`}
            >
              {t('landing.hero.primary')}
            </Link>
            <a
              href="#how"
              className={`${LINK_BTN} border border-green-200 text-white underline-offset-4 hover:underline`}
            >
              {t('landing.hero.secondary')}
            </a>
          </div>
        </div>
        <figure className="mx-auto w-full max-w-[260px] space-y-2 md:max-w-[300px]">
          <img
            src="/landing/hero-health-390.webp"
            srcSet="/landing/hero-health-390.webp 390w, /landing/hero-health-780.webp 780w"
            sizes="(min-width: 768px) 300px, 260px"
            width={390}
            height={844}
            alt={t('landing.hero.phoneAlt')}
            fetchPriority="high"
            className="w-full rounded-[28px] border-4 border-green-200/40 bg-paper"
          />
          <figcaption className="text-center text-small text-green-200">
            {t('landing.hero.phoneTag')}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function SectionTitle({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-4 font-heading text-title font-semibold md:text-3xl">
      {children}
    </h2>
  );
}

/** Row bands on the cropped bill image, as fractions of its width and height. */
const BILL_MARKS = [
  { key: 'pf', top: 0.5508, height: 0.0501 },
  { key: 'md', top: 0.4507, height: 0.1001 },
  { key: 'peak', top: 0.6009, height: 0.0501 },
] as const;

function BillDecoded() {
  const { t } = useTranslation();
  const amount: Record<string, string> = {
    pf: formatInr(60000),
    md: formatInr(40000),
    peak: formatInr(2),
  };
  return (
    <section className={`bg-paper py-12 ${DEFER}`}>
      <div className={`${WRAP} space-y-6`}>
        <SectionTitle>{t('landing.bill.title')}</SectionTitle>
        <p className="max-w-2xl text-ink-muted">{t('landing.bill.intro')}</p>
        <div className="grid items-start gap-8 md:grid-cols-2">
          <figure className="space-y-2">
            <div className="relative">
              <img
                src="/landing/bill-800.webp"
                srcSet="/landing/bill-480.webp 480w, /landing/bill-800.webp 800w, /landing/bill-1200.webp 1200w"
                sizes="(min-width: 768px) 480px, 100vw"
                width={1200}
                height={1118}
                loading="lazy"
                alt={t('landing.bill.alt')}
                className="w-full rounded-card border bg-surface shadow-card"
              />
              {BILL_MARKS.map((m, i) => (
                <span
                  key={m.key}
                  aria-hidden="true"
                  className="absolute rounded-[4px] border-2 border-copper-700"
                  style={{
                    left: '6.5%',
                    width: '87%',
                    top: `${m.top * 100}%`,
                    height: `${m.height * 100}%`,
                  }}
                >
                  <span className="num absolute top-1/2 -left-8 grid size-6 -translate-y-1/2 place-items-center rounded-chip bg-copper-700 text-small font-bold text-white">
                    {i + 1}
                  </span>
                </span>
              ))}
            </div>
            <figcaption className="text-small font-semibold text-copper-800">
              {t('landing.bill.sample')}
            </figcaption>
          </figure>
          <ol className="space-y-4">
            {BILL_MARKS.map((m, i) => (
              <li key={m.key} className="flex gap-3 rounded-card border bg-surface p-4 shadow-card">
                <span className="num font-heading text-title font-bold text-copper-700">
                  {i + 1}
                </span>
                <div className="space-y-1">
                  <h3 className="font-heading text-card-title font-semibold">
                    {t(`landing.bill.${m.key}.name`)}
                  </h3>
                  <p className="text-small text-ink-muted">{t(`landing.bill.${m.key}.means`)}</p>
                  <p className="num text-body font-semibold text-copper-800">
                    {t(`landing.bill.${m.key}.cost`, { amount: amount[m.key] })}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

const STEP_IMG = { s1: 'step-add', s2: 'step-check', s3: 'step-see' } as const;
const YEAR_TILES = ['O', 'N', 'D', 'J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S'].map((label) => ({
  label,
  confirmed: true,
}));

function HowItWorks() {
  const { t } = useTranslation();
  const steps = ['s1', 's2', 's3', 's4'] as const;
  return (
    <section id="how" className={`scroll-mt-4 bg-surface py-12 ${DEFER}`}>
      <div className={`${WRAP} space-y-8`}>
        <SectionTitle>{t('landing.how.title')}</SectionTitle>
        <ol className="grid gap-8 border-l-2 pl-5 md:grid-cols-4 md:gap-4 md:border-t-2 md:border-l-0 md:pt-6 md:pl-0">
          {steps.map((s, i) => (
            <li key={s} className="relative space-y-3">
              <span
                aria-hidden="true"
                className="absolute top-1 -left-[1.6rem] block size-3 rounded-chip bg-green-700 md:-top-[1.85rem] md:left-0"
              />
              <p className="num font-heading text-hero font-bold text-green-700">{i + 1}</p>
              <h3 className="font-heading text-card-title font-semibold">
                {t(`landing.how.${s}.title`)}
              </h3>
              <p className="text-small text-ink-muted">{t(`landing.how.${s}.body`)}</p>
              {s !== 's4' ? (
                <img
                  src={`/landing/${STEP_IMG[s]}-390.webp`}
                  width={390}
                  height={s === 's3' ? 210 : 420}
                  loading="lazy"
                  alt={t(`landing.how.${s}.alt`)}
                  className="w-full max-w-[260px] rounded-card border shadow-card"
                />
              ) : (
                <div className="max-w-[260px] space-y-1 rounded-card border bg-paper p-3">
                  <YearStrip months={YEAR_TILES} />
                  <p className="text-small font-semibold text-copper-800">
                    {t('landing.how.s4.sample')}
                  </p>
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const digits = (s: string) => Number(s.replace(/[^\d]/g, '')) || 0;

function MoneyMaths() {
  const { t } = useTranslation();
  const [loan, setLoan] = useState('10,00,000');
  const [rate, setRate] = useState('8');
  const [months, setMonths] = useState('60');
  const [saving, setSaving] = useState('60,000');
  const principal = digits(loan);
  const tenure = Math.floor(Number(months));
  const annualRate = Number(rate);
  const monthly = digits(saving);
  const valid = principal > 0 && tenure > 0 && annualRate >= 0 && Number.isFinite(annualRate);
  const calc = valid
    ? (() => {
        const e = emi({ principal, annualRatePct: annualRate, months: tenure });
        return { emi: e, test: cashTest({ emi: e, monthlySavingLow: monthly }) };
      })()
    : null;
  const field = 'mt-1 min-h-12 w-full rounded-button border bg-surface px-3 text-body';
  return (
    <section className={`bg-paper py-12 ${DEFER}`}>
      <div className={`${WRAP} grid items-start gap-8 md:grid-cols-2`}>
        <div className="space-y-4">
          <SectionTitle>{t('landing.money.title')}</SectionTitle>
          <p className="text-ink-muted">{t('landing.money.intro')}</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 block text-small">
              {t('landing.money.loan')}
              <input
                inputMode="numeric"
                className={`${field} num`}
                value={loan}
                onChange={(e) => setLoan(e.target.value)}
              />
            </label>
            <label className="block text-small">
              {t('landing.money.rate')}
              <input
                inputMode="decimal"
                className={`${field} num`}
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </label>
            <label className="block text-small">
              {t('landing.money.months')}
              <input
                inputMode="numeric"
                className={`${field} num`}
                value={months}
                onChange={(e) => setMonths(e.target.value)}
              />
            </label>
            <label className="col-span-2 block text-small">
              {t('landing.money.saving')}
              <input
                inputMode="numeric"
                className={`${field} num`}
                value={saving}
                onChange={(e) => setSaving(e.target.value)}
              />
            </label>
          </div>
        </div>
        <div
          className="space-y-3 rounded-card border bg-surface p-4 shadow-card"
          data-testid="money"
        >
          {calc && (
            <>
              <EmiVsSavingBar emi={Math.round(calc.emi)} saving={monthly} />
              <p className="text-small text-ink-muted">
                {calc.test.cashPositiveFromMonth1
                  ? t('landing.money.covered')
                  : t('landing.money.notCovered')}
              </p>
            </>
          )}
          <p className="text-small font-semibold text-copper-800">{t('landing.money.example')}</p>
          <p className="text-small text-ink-muted">{t('landing.money.small')}</p>
        </div>
      </div>
    </section>
  );
}

function Qr({ url, alt }: { url: string; alt: string }) {
  const [svg, setSvg] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  // The QR library loads only when the code is about to be seen.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let live = true;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        void import('qrcode').then((m) =>
          m.default.toString(url, { type: 'svg', margin: 1, width: 176 }).then((out) => {
            if (live) setSvg(out);
          }),
        );
      },
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => {
      live = false;
      io.disconnect();
    };
  }, [url]);
  return (
    <div
      ref={ref}
      role="img"
      aria-label={alt}
      className="size-44 shrink-0 rounded-card border bg-white p-1 [&>svg]:size-full"
      // The SVG is produced locally by the qrcode library from our own URL.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function Proof() {
  const { t } = useTranslation();
  const url = `${window.location.origin}/verify/${DEMO_REPORT_ID}`;
  return (
    <section className={`bg-surface py-12 ${DEFER}`}>
      <div className={`${WRAP} grid items-start gap-8 md:grid-cols-2`}>
        <div className="space-y-4">
          <SectionTitle>{t('landing.proof.title')}</SectionTitle>
          <p className="text-ink-muted">{t('landing.proof.lead')}</p>
          <div className="flex flex-wrap items-center gap-4 py-2">
            <StampBadge variant="early" />
            <span aria-hidden="true" className="text-title text-ink-muted">
              →
            </span>
            <StampBadge variant="verified" />
          </div>
          <p className="text-small text-ink-muted">{t('landing.proof.method')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Qr url={url} alt={t('landing.proof.qrAlt')} />
          <div className="min-w-[12rem] flex-1 space-y-2">
            <p className="font-semibold">{t('landing.proof.qrText')}</p>
            <p className="text-small text-ink-muted">{t('landing.proof.qrNote')}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhoFor() {
  const { t } = useTranslation();
  const cols = ['msme', 'home', 'lender'] as const;
  return (
    <section className={`bg-paper py-12 ${DEFER}`}>
      <div className={`${WRAP} space-y-6`}>
        <SectionTitle>{t('landing.who.title')}</SectionTitle>
        <div className="grid gap-6 md:grid-cols-3">
          {cols.map((c) => (
            <div key={c} className="space-y-2 border-t-2 border-green-700 pt-3">
              <h3 className="font-heading text-card-title font-semibold">
                {t(`landing.who.${c}.name`)}
              </h3>
              <p className="text-ink-muted">{t(`landing.who.${c}.body`)}</p>
            </div>
          ))}
        </div>
        <p className="max-w-3xl rounded-card bg-green-50 p-4 font-semibold text-green-700">
          {t('landing.who.zed')}
        </p>
      </div>
    </section>
  );
}

function DataCall() {
  const { t, i18n } = useTranslation();
  const ref = useRef<HTMLElement>(null);
  // Telugu and Devanagari fonts download only once the visitor scrolls near this section.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    let io: IntersectionObserver | undefined;
    const start = () => {
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            void loadScriptFonts('te');
            void loadScriptFonts('hi');
            io?.disconnect();
          }
        },
        { rootMargin: '400px' },
      );
      io.observe(el);
    };
    window.addEventListener('scroll', start, { once: true, passive: true });
    return () => {
      window.removeEventListener('scroll', start);
      io?.disconnect();
    };
  }, []);
  const samples = [
    { lng: 'en', label: 'English' },
    { lng: 'te', label: 'తెలుగు' },
    { lng: 'hi', label: 'हिन्दी' },
  ];
  return (
    <section ref={ref} className={`bg-surface py-12 ${DEFER}`}>
      <div className={`${WRAP} space-y-6`}>
        <ul className="grid gap-4 md:grid-cols-3" aria-label={t('landing.data.samples')}>
          {samples.map((s) => (
            <li key={s.lng} lang={s.lng} className="rounded-card border bg-paper p-4">
              <p className="text-small text-ink-muted">{s.label}</p>
              <h2 className="font-heading text-title font-semibold">
                {i18n.t('landing.data.title', { lng: s.lng })}
              </h2>
            </li>
          ))}
        </ul>
        <ul className="grid gap-3 md:grid-cols-2">
          {(['p1', 'p2', 'p3', 'p4'] as const).map((p, i) => (
            <li key={p} className="flex gap-3">
              <span className="num font-heading text-card-title font-bold text-green-700">
                {i + 1}
              </span>
              <span>{t(`landing.data.${p}`)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="bg-green-900 text-green-200" style={{ backgroundImage: GRAIN }}>
      <div className={`${WRAP} space-y-1 py-8 text-small`}>
        <p className="font-semibold text-white">{t('landing.footer.sdg')}</p>
        <p>{t('landing.footer.team')}</p>
        <p>{t('landing.footer.proto')}</p>
        <p>{t('landing.footer.note')}</p>
      </div>
    </footer>
  );
}

export default function Landing() {
  // The rupee sign lives in Latin Extended: fetch the full fonts on first scroll, or on leaving.
  useEffect(() => {
    const go = () => void loadFullFonts();
    window.addEventListener('scroll', go, { once: true, passive: true });
    return () => {
      window.removeEventListener('scroll', go);
      go();
    };
  }, []);

  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <main>
        <Hero />
        <BillDecoded />
        <HowItWorks />
        <MoneyMaths />
        <Proof />
        <WhoFor />
        <DataCall />
      </main>
      <Footer />
    </div>
  );
}
