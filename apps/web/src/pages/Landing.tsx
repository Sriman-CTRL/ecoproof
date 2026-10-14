import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { loadFullFonts } from '../i18n/fonts';
import { prefersReducedMotion } from '../components/kit/motion';
import {
  GRAIN,
  LINK_BTN,
  PublicLayout,
  SectionTitle,
  WRAP,
} from '../components/site/PublicLayout';
import { DEMO_REPORT_ID } from '../components/site/content';

/** Landing page: public, no login. New copy uses English defaults (Telugu falls back to English). */

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
const BTN_PRIMARY = `${LINK_BTN} bg-copper-500 text-green-900 shadow-card transition hover:brightness-95 ${FOCUS} focus-visible:outline-white`;
const BTN_GHOST = `${LINK_BTN} border border-green-200 text-white transition hover:bg-green-700 ${FOCUS} focus-visible:outline-white`;

/** Fade in once when scrolled into view. Always visible under reduced motion. */
function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(() => prefersReducedMotion());
  useEffect(() => {
    const el = ref.current;
    if (shown || !el || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);
  return (
    <div
      ref={ref}
      className={`${className} transition duration-500 ${shown ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}
    >
      {children}
    </div>
  );
}

/** Counts from 0 to the target when scrolled into view; the final text is exact. */
function CountUp({ to, decimals = 0, to2 }: { to: number; decimals?: number; to2?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const fmt = (v: number) => v.toFixed(decimals);
  const fin = to2 != null ? `${fmt(to)}-${fmt(to2)}` : fmt(to);
  const [text, setText] = useState(prefersReducedMotion() ? fin : fmt(0));
  useEffect(() => {
    const el = ref.current;
    if (prefersReducedMotion() || !el || typeof IntersectionObserver === 'undefined') {
      setText(fin);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / 1200);
        const k = 1 - (1 - p) ** 3;
        setText(
          p >= 1 ? fin : to2 != null ? `${fmt(to * k)}-${fmt(to2 * k)}` : fmt(to * k),
        );
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fin]);
  return (
    <span ref={ref} aria-label={fin} className="num">
      <span aria-hidden="true">{text}</span>
    </span>
  );
}

function Hero() {
  const { t } = useTranslation();
  return (
    <section className="bg-green-900 text-white" style={{ backgroundImage: GRAIN }}>
      <div className={`${WRAP} space-y-6 py-12 md:py-20`}>
        <p className="inline-block rounded-chip border border-green-200/50 px-3 py-1 text-small font-semibold text-copper-500">
          {t('landing.footer.sdg')}
        </p>
        <h1 className="font-heading text-hero font-semibold md:text-6xl md:leading-[4rem]">
          {t(
            'landing2.hero.title',
            'Small free steps that turn factory owners into people who act on climate.',
          )}
        </h1>
        <p className="max-w-3xl text-body text-green-200 md:text-xl md:leading-8">
          {t(
            'landing2.hero.sub',
            'Snap the bill you already have. See the carbon and the rupees lost, side by side, then take your next free step.',
          )}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link to="/login" className={BTN_PRIMARY}>
            {t('landing.nav.signIn')}
          </Link>
          <Link to="/start" className={BTN_GHOST}>
            {t('landing2.hero.sample', 'See the sample foundry')}
          </Link>
        </div>
        <Link
          to={`/verify/${DEMO_REPORT_ID}`}
          className={`inline-flex min-h-12 items-center gap-1 text-green-200 underline underline-offset-4 hover:text-white ${FOCUS} focus-visible:outline-white`}
        >
          {t('landing2.hero.seal', 'Check a sealed carbon statement')}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function LiveStrip() {
  const { t } = useTranslation();
  return (
    <section className="border-b bg-green-50 py-8">
      <div className={`${WRAP} space-y-4`}>
        <p className="text-small font-semibold text-green-700">
          {t('landing2.strip.label', 'Sample foundry, synthetic bills')}
        </p>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-card bg-surface p-4 shadow-card">
            <dt className="text-small text-ink-muted">
              {t('landing2.strip.co2', 't CO2 in September (63.6 t grid power, 3.2 t diesel)')}
            </dt>
            <dd className="font-heading text-hero font-bold text-green-700">
              <CountUp to={66.8} decimals={1} />
            </dd>
          </div>
          <div className="rounded-card bg-surface p-4 shadow-card">
            <dt className="text-small text-ink-muted">
              {t('landing2.strip.save', 'a year kept from two bill fixes, no loan')}
            </dt>
            <dd className="font-heading text-hero font-bold text-copper-800">
              Rs <CountUp to={13.5} decimals={1} /> {t('landing2.strip.lakh', 'lakh')}
            </dd>
          </div>
          <div className="rounded-card bg-surface p-4 shadow-card">
            <dt className="text-small text-ink-muted">
              {t('landing2.strip.cut', 't CO2 a year cut by an efficient furnace')}
            </dt>
            <dd className="font-heading text-hero font-bold text-green-700">
              <CountUp to={41} to2={50} />
            </dd>
          </div>
          <div className="rounded-card bg-surface p-4 shadow-card">
            <dt className="text-small text-ink-muted">
              {t('landing2.strip.mitra', 'for every Mitra step')}
            </dt>
            <dd className="font-heading text-hero font-bold text-copper-800">
              Rs <CountUp to={0} />
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function NoOneAlone() {
  const { t } = useTranslation();
  const items = [
    {
      big: '135 Mt',
      body: "CO2e from India's MSMEs in 2022",
      src: 'NITI Aayog, Jan 2026',
    },
    {
      big: '7 of 3,400',
      body: 'units reached by a green machinery subsidy',
      src: 'Mongabay, Jun 2026',
    },
    {
      big: '73.2%',
      body: "of MSMEs don't know green finance exists for them",
      src: 'Kinara Capital, 2025',
    },
  ];
  return (
    <section className="bg-paper py-12">
      <Reveal className={`${WRAP} space-y-6`}>
        <SectionTitle>{t('landing2.alone.title', 'No one starts alone')}</SectionTitle>
        <ul className="grid gap-4 md:grid-cols-3">
          {items.map((i) => (
            <li key={i.big} className="rounded-card border bg-surface p-5 shadow-card">
              <p className="num font-heading text-hero font-bold text-green-700">{i.big}</p>
              <p className="mt-1">{i.body}</p>
              <p className="mt-2 text-small text-ink-muted">Source: {i.src}</p>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}

const STEPS = [
  {
    n: 1,
    title: 'See it',
    price: 'Rs 0',
    body: 'Your bill becomes carbon and rupees, side by side.',
    to: '/carbon',
    cta: 'Open carbon and rupees',
  },
  {
    n: 2,
    title: 'Fix it free',
    price: 'Rs 0',
    body: 'Bill fixes that need no spending.',
    to: '/actions',
    cta: 'See the free bill fixes',
  },
  {
    n: 3,
    title: 'Get free help',
    price: 'Rs 0',
    body: 'Mitra: ZED pledge, free assessment, climate pledge 754 t to 377 t.',
    to: '/mitra',
    cta: 'Open Mitra',
  },
  {
    n: 4,
    title: 'Bigger fix',
    price: 'Paid by savings',
    body: 'A new furnace. The saving pays the EMI of Rs 43,252.',
    to: '/actions',
    cta: 'See the loan maths',
  },
  {
    n: 5,
    title: 'Prove and share',
    price: 'Rs 0',
    body: 'Your next bills prove it. Share it with the Green Community.',
    to: '/community',
    cta: 'Open Green Community',
  },
];

function Journey() {
  const { t } = useTranslation();
  const [i, setI] = useState(0);
  const s = STEPS[i]!;
  return (
    <section className="bg-surface py-12">
      <Reveal className={`${WRAP} space-y-6`}>
        <SectionTitle>{t('landing2.journey.title', 'Five steps, each one free')}</SectionTitle>
        <div role="tablist" aria-label="Journey" className="grid grid-cols-5 gap-2">
          {STEPS.map((st, k) => (
            <button
              key={st.n}
              type="button"
              role="tab"
              id={`step-tab-${st.n}`}
              aria-selected={k === i}
              aria-controls="step-panel"
              onClick={() => setI(k)}
              className={`flex min-h-16 flex-col items-center justify-center rounded-card border px-1 py-2 text-center transition hover:border-green-600 ${FOCUS} focus-visible:outline-green-700 ${
                k === i ? 'border-green-700 bg-green-700 text-white' : 'bg-paper'
              }`}
            >
              <span className="num font-heading text-card-title font-bold">{st.n}</span>
              <span className="hidden text-small font-semibold md:block">{st.title}</span>
            </button>
          ))}
        </div>
        <div
          id="step-panel"
          role="tabpanel"
          aria-labelledby={`step-tab-${s.n}`}
          className="rounded-card border bg-paper p-5 md:p-6"
        >
          <p className="text-small font-semibold text-copper-800">
            Step {s.n} · {s.price}
          </p>
          <h3 className="font-heading text-title font-semibold">{s.title}</h3>
          <p className="mt-2 max-w-2xl">{s.body}</p>
          <Link
            to={s.to}
            className={`mt-4 inline-flex min-h-12 items-center gap-1 font-semibold text-green-700 underline underline-offset-4 hover:text-green-900 ${FOCUS} focus-visible:outline-green-700`}
          >
            {s.cta}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

function RealPerson() {
  const { t } = useTranslation();
  const cards = [
    ['Phone sign-in', 'Sign in with your phone number (demo code in this prototype).'],
    ['Udyam check', 'Matched to documents.'],
    ['An edited bill gets caught', 'It is recomputed from the TGERC tariff.'],
    ['Locked months', 'Corrections need a reason.'],
  ];
  return (
    <section className="bg-paper py-12">
      <Reveal className={`${WRAP} space-y-6`}>
        <SectionTitle>
          {t('landing2.real.title', 'Real person, real business, real bills')}
        </SectionTitle>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(([h, b]) => (
            <li
              key={h}
              className="rounded-card border bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:border-green-600"
            >
              <h3 className="font-heading text-card-title font-semibold">{h}</h3>
              <p className="mt-1 text-ink-muted">{b}</p>
            </li>
          ))}
        </ul>
        <Link
          to="/login"
          className={`${LINK_BTN} bg-green-700 text-white transition hover:bg-green-900 ${FOCUS} focus-visible:outline-green-700`}
        >
          {t('landing2.real.cta', "Try it: add your unit's data")}
        </Link>
      </Reveal>
    </section>
  );
}

const FEATURES = [
  ['Add your data', '/login', 'Bills, fuel and output, confirmed by you.'],
  ['Mitra', '/mitra', 'Free NGO and public programme steps.'],
  ['Green Community', '/community', 'Peers in the same trade, by choice.'],
  ['Loan maths', '/actions', 'Does the saving cover the EMI?'],
  ['Carbon statement', '/carbon-method', 'How the carbon figure is worked out.'],
  ['For homes', '/for-homes', 'The same bill, for a household.'],
  ['For lenders', '/for-lenders', 'A summary for the lender’s own assessment.'],
  ['For buyers', '/for-buyers', 'Carbon data a buyer may ask for.'],
] as const;

function Features() {
  const { t } = useTranslation();
  return (
    <section className="bg-surface py-12">
      <Reveal className={`${WRAP} space-y-6`}>
        <SectionTitle>{t('landing2.features.title', 'What is inside')}</SectionTitle>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(([h, to, b]) => (
            <li key={h}>
              <Link
                to={to}
                className={`group block h-full rounded-card border bg-paper p-5 transition hover:border-green-600 hover:shadow-card ${FOCUS} focus-visible:outline-green-700`}
              >
                <span className="flex items-center justify-between font-heading text-card-title font-semibold">
                  {h}
                  <ArrowRight
                    size={18}
                    aria-hidden="true"
                    className="transition group-hover:translate-x-1"
                  />
                </span>
                <span className="mt-1 block text-ink-muted">{b}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}

const ROWS = [
  ['Starts from', 'a form', 'a site visit', 'the bill they have'],
  ['Rupees beside carbon', '-', 'sometimes', 'every screen'],
  ['Pays for the fix', '-', '-', 'loan maths'],
  ['Connects to free help', '-', '-', 'Mitra, Rs 0'],
  ['Peer support', '-', '-', 'Green Community'],
  ['Proves the result', '-', 'once a year', 'every month from bills'],
  ['Cost to a small unit', 'free', 'about Rs 2 lakh a year', 'free'],
];

function Compare() {
  const { t } = useTranslation();
  return (
    <section className="bg-paper py-12">
      <Reveal className={`${WRAP} space-y-6`}>
        <SectionTitle>
          {t('landing2.compare.title', 'Calculators give a number. EcoProof changes habits.')}
        </SectionTitle>
        <div className="overflow-x-auto rounded-card border bg-surface">
          <table className="w-full min-w-[34rem] border-collapse text-left text-small md:text-body">
            <thead>
              <tr className="border-b bg-green-50">
                <th scope="col" className="p-3" />
                <th scope="col" className="p-3 font-semibold">
                  Free calculators
                </th>
                <th scope="col" className="p-3 font-semibold">
                  Paid consultants
                </th>
                <th scope="col" className="bg-green-100 p-3 font-semibold text-green-900">
                  EcoProof
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([h, a, b, c]) => (
                <tr key={h} className="border-b last:border-0 hover:bg-paper">
                  <th scope="row" className="p-3 font-semibold">
                    {h}
                  </th>
                  <td className="p-3 text-ink-muted">{a}</td>
                  <td className="p-3 text-ink-muted">{b}</td>
                  <td className="bg-green-50 p-3 font-semibold text-green-900">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
    </section>
  );
}

function Closing() {
  const { t } = useTranslation();
  return (
    <section className="bg-green-900 text-white" style={{ backgroundImage: GRAIN }}>
      <Reveal className={`${WRAP} space-y-5 py-12 text-center md:py-16`}>
        <h2 className="font-heading text-hero font-semibold">
          {t('landing2.close.title', 'Every next step is free.')}
        </h2>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/login" className={BTN_PRIMARY}>
            {t('landing.nav.signIn')}
          </Link>
          <Link to="/start" className={BTN_GHOST}>
            {t('landing2.hero.sample', 'See the sample foundry')}
          </Link>
        </div>
        <p className="text-small text-green-200">Team BuildOne, CBIT Hyderabad, SDG 13</p>
      </Reveal>
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
      <LiveStrip />
      <NoOneAlone />
      <Journey />
      <RealPerson />
      <Features />
      <Compare />
      <Closing />
    </PublicLayout>
  );
}
