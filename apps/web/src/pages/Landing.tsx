import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { StampBadge } from '../components/kit/StampBadge';
import { SourceChip } from '../components/kit/SourceChip';
import {
  Band,
  DEFER,
  GRAIN,
  LINK_BTN,
  PublicLayout,
  SectionTitle,
  WRAP,
} from '../components/site/PublicLayout';
import { DEMO_REPORT_ID, monthYear, SDG_ROWS, STAGES } from '../components/site/content';
import { SampleLoanExample } from '../components/site/LoanExample';
import { Qr } from '../components/site/Qr';
import { loadFullFonts, loadScriptFonts } from '../i18n/fonts';
import { formatDecimal, formatFactor, formatInr, formatNumber } from '../lib/format';
import { SAMPLE_BILL } from '../lib/sampleBill';

/** Landing page (plan section 5). Public: no login, no consent gate, no tab bar. */

const t1 = (n: number) => formatDecimal(Math.round(n * 10) / 10);

function Hero() {
  const { t, i18n } = useTranslation();
  const c = SAMPLE_BILL.carbon;
  return (
    <section className="bg-green-900 text-white" style={{ backgroundImage: GRAIN }}>
      <div className={`${WRAP} grid items-center gap-8 py-10 md:grid-cols-[3fr_2fr] md:py-16`}>
        <div className="space-y-5">
          <h1 className="font-heading text-hero font-semibold md:text-5xl md:leading-[3.25rem]">
            {t('landing.hero.title')}
          </h1>
          <p className="text-body text-green-200">{t('landing.hero.sub')}</p>
          <figure className="space-y-2" data-testid="hero-figures">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-card bg-green-50 p-4 text-green-900">
                <p className="num font-heading text-hero font-bold">
                  {t('landing.hero.co2', { value: t1(c.totalT) })}
                </p>
                <p className="text-small">{t('landing.hero.co2Label')}</p>
              </div>
              <div className="rounded-card bg-surface p-4 text-green-900">
                <p className="num font-heading text-hero font-bold text-copper-800">
                  {formatInr(SAMPLE_BILL.atStakeInr)}
                </p>
                <p className="text-small">{t('landing.hero.atStake')}</p>
              </div>
            </div>
            <figcaption className="text-small font-semibold text-copper-500">
              {t('landing.hero.figTag', {
                month: monthYear(SAMPLE_BILL.periodStart, i18n.resolvedLanguage ?? 'en'),
              })}
            </figcaption>
          </figure>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to="/start"
              className={`${LINK_BTN} min-h-13 bg-copper-500 text-green-900 shadow-card`}
            >
              {t('landing.hero.primary')}
            </Link>
            <Link
              to="/how-it-works"
              className={`${LINK_BTN} border border-green-200 text-white underline-offset-4 hover:underline`}
            >
              {t('landing.hero.secondary')}
            </Link>
          </div>
        </div>
        <figure className="mx-auto w-full max-w-[260px] space-y-2 md:max-w-[300px]">
          <img
            src="/landing/hero-health-390.webp"
            srcSet="/landing/hero-health-390.webp 390w, /landing/hero-health-780.webp 780w"
            sizes="(min-width: 768px) 300px, 260px"
            width={390}
            height={844}
            alt={t('landing.hero.phoneAlt', { inr: formatInr(SAMPLE_BILL.pfLossInr) })}
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

/** Row bands on the cropped bill image, as fractions of its width and height. */
const BILL_MARKS = [
  { key: 'pf', top: 0.5508, height: 0.0501 },
  { key: 'md', top: 0.4507, height: 0.1001 },
  { key: 'peak', top: 0.6009, height: 0.0501 },
] as const;

function BillDecoded() {
  const { t } = useTranslation();
  const grid = SAMPLE_BILL.carbon.grid;
  const amount: Record<string, string> = {
    pf: formatInr(SAMPLE_BILL.pfLossInr),
    md: formatInr(SAMPLE_BILL.demandOverpayInr),
    peak: formatInr(SAMPLE_BILL.peakShiftPerUnitInr),
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
                  <p className="text-small font-semibold text-green-700">
                    {t(`landing.bill.${m.key}.carbon`)}
                  </p>
                </div>
              </li>
            ))}
            <li
              className="flex gap-3 rounded-card border border-green-700 bg-green-50 p-4 shadow-card"
              data-testid="bill-units"
            >
              <span className="num font-heading text-title font-bold text-green-700">4</span>
              <div className="space-y-1">
                <h3 className="font-heading text-card-title font-semibold">
                  {t('landing.bill.units.name', { kwh: formatNumber(SAMPLE_BILL.kwh) })}
                </h3>
                <p className="text-small text-ink-muted">{t('landing.bill.units.means')}</p>
                <p className="num text-body font-semibold text-green-700">
                  <SourceChip lineName={grid.source}>
                    {t('landing.bill.units.co2', {
                      kwh: formatNumber(SAMPLE_BILL.kwh),
                      factor: formatFactor(grid.value),
                      version: grid.version,
                      t: t1(SAMPLE_BILL.carbon.scope2T),
                    })}
                  </SourceChip>
                </p>
              </div>
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}

function FromBillToProof() {
  const { t } = useTranslation();
  return (
    <Band id="how" tone="surface">
      <SectionTitle>{t('landing.how.title')}</SectionTitle>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STAGES.map((s, i) => (
          <li key={s} className="flex gap-3 rounded-card border bg-paper p-4">
            <span className="num font-heading text-title font-bold text-green-700">{i + 1}</span>
            <div className="space-y-1">
              <h3 className="font-heading text-card-title font-semibold">
                {t(`site.how.${s}.title`)}
              </h3>
              <p className="text-small text-ink-muted">{t(`site.how.${s}.short`)}</p>
            </div>
          </li>
        ))}
      </ol>
      <Link to="/how-it-works" className={`${LINK_BTN} border border-green-700 text-green-700`}>
        {t('landing.how.more')}
      </Link>
    </Band>
  );
}

function MoneyMaths() {
  const { t } = useTranslation();
  return (
    <Band id="money">
      <SectionTitle>{t('landing.money.title')}</SectionTitle>
      <div className="max-w-3xl space-y-1 rounded-card border-l-4 border-green-700 bg-surface p-4">
        <h3 className="font-heading text-card-title font-semibold">
          {t('landing.money.whyTitle')}
        </h3>
        <p className="text-ink-muted">{t('landing.money.why')}</p>
      </div>
      <SampleLoanExample />
    </Band>
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

const WHO_LINK = { msme: '/how-it-works', home: '/for-homes', lender: '/for-lenders' } as const;

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
              <Link
                to={WHO_LINK[c]}
                className="inline-flex min-h-12 items-center font-semibold text-green-700 underline underline-offset-4"
              >
                {t(`landing.who.${c}.link`)}
              </Link>
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

function SdgStrip() {
  const { t } = useTranslation();
  return (
    <Band tone="surface">
      <SectionTitle>{t('site.sdg.title')}</SectionTitle>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {SDG_ROWS.map((r) => (
          <li key={r} className="space-y-1 border-t-2 border-green-700 pt-3">
            <h3 className="font-heading text-card-title font-semibold">
              {t(`site.sdg.${r}.name`)}
            </h3>
            <p className="text-small text-ink-muted">{t(`site.sdg.${r}.short`)}</p>
          </li>
        ))}
      </ul>
      <Link
        to="/about"
        className="inline-flex min-h-12 items-center font-semibold text-green-700 underline underline-offset-4"
      >
        {t('site.sdg.more')}
      </Link>
    </Band>
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
    <PublicLayout>
      <Hero />
      <BillDecoded />
      <FromBillToProof />
      <MoneyMaths />
      <Proof />
      <WhoFor />
      <SdgStrip />
      <DataCall />
    </PublicLayout>
  );
}
