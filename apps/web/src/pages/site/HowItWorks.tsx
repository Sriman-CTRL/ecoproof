import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { StampBadge } from '../../components/kit/StampBadge';
import { actionCo2Text } from '../../components/ui';
import { DEMO_CARBON_STATEMENT_ID, STAGES } from '../../components/site/content';
import { SampleLoanResult } from '../../components/site/LoanExample';
import { Band, LINK_BTN, PageHero, PublicLayout } from '../../components/site/PublicLayout';
import { Qr } from '../../components/site/Qr';
import { SampleSkeleton } from '../../components/site/SampleSkeleton';
import { formatDecimal, formatInr } from '../../lib/format';
import { usePublicSample } from '../../lib/publicSample';
import { SAMPLE_BILL } from '../../lib/sampleBill';

const t2 = (n: number) => formatDecimal(Math.round(n * 100) / 100);

function Shot({ src, height, alt }: { src: string; height: number; alt: string }) {
  return (
    <img
      src={src}
      width={390}
      height={height}
      loading="lazy"
      alt={alt}
      className="mx-auto w-full max-w-[300px] rounded-card border bg-surface shadow-card"
    />
  );
}

function TopFixes() {
  const { t } = useTranslation();
  const sample = usePublicSample();
  if (!sample.data) return <SampleSkeleton error={sample.isError} />;
  return (
    <ol className="space-y-2" data-testid="how-fixes">
      {sample.data.actions.slice(0, 3).map((a, i) => (
        <li key={a.code} className="flex gap-3 rounded-card border bg-surface p-3">
          <span className="num font-heading text-card-title font-bold text-green-700">{i + 1}</span>
          <div className="min-w-0 space-y-0.5">
            <p className="font-semibold">
              {t(`actions.name.${a.code}`, { defaultValue: a.title })}
            </p>
            {a.annualInrMid != null && (
              <p className="num text-small">
                {formatInr(Math.round(a.annualInrMid))} {t('actions.perYear')}
              </p>
            )}
            {actionCo2Text(a, t) && (
              <p className="num text-small font-semibold text-green-700">{actionCo2Text(a, t)}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Stage({ n, s, visual }: { n: number; s: (typeof STAGES)[number]; visual: ReactNode }) {
  const { t } = useTranslation();
  const c = SAMPLE_BILL.carbon;
  const vars = {
    s2: t2(c.scope2T),
    s1: t2(c.scope1T),
    inr: formatInr(SAMPLE_BILL.atStakeInr),
  };
  return (
    <li
      className="grid gap-6 border-t-2 border-green-700 pt-6 md:grid-cols-2 md:items-start"
      data-testid={`stage-${n}`}
    >
      <div className="space-y-3">
        <p className="num font-heading text-hero font-bold text-green-700">{n}</p>
        <h2 className="font-heading text-title font-semibold">{t(`site.how.${s}.title`)}</h2>
        <div className="space-y-1">
          <h3 className="text-small font-semibold text-ink-muted">{t('site.how.owner')}</h3>
          <p>{t(`site.how.${s}.owner`)}</p>
        </div>
        <div className="space-y-1">
          <h3 className="text-small font-semibold text-ink-muted">{t('site.how.calc')}</h3>
          <p className="num">{t(`site.how.${s}.calc`, vars)}</p>
        </div>
      </div>
      <div>{visual}</div>
    </li>
  );
}

export default function HowItWorks() {
  const { t } = useTranslation();
  const verifyUrl = `${window.location.origin}/verify/${DEMO_CARBON_STATEMENT_ID}`;
  const visuals: Record<(typeof STAGES)[number], ReactNode> = {
    s1: <Shot src="/landing/step-add-390.webp" height={420} alt={t('site.how.s1.alt')} />,
    s2: <Shot src="/landing/step-see-390.webp" height={210} alt={t('site.how.s2.alt')} />,
    s3: <TopFixes />,
    s4: (
      <div className="rounded-card border bg-surface p-4 shadow-card">
        <SampleLoanResult />
      </div>
    ),
    s5: (
      <div className="flex flex-wrap items-center gap-4 rounded-card border bg-surface p-4">
        <StampBadge variant="early" />
        <span aria-hidden="true" className="text-title text-ink-muted">
          →
        </span>
        <StampBadge variant="verified" />
      </div>
    ),
    s6: (
      <div className="flex flex-wrap items-center gap-4">
        <Qr url={verifyUrl} alt={t('site.how.s6.qr')} />
        <p className="max-w-56 font-semibold">{t('site.how.s6.qr')}</p>
      </div>
    ),
  };
  return (
    <PublicLayout>
      <PageHero title={t('site.how.title')} lead={t('site.how.lead')} />
      <Band defer={false}>
        <ol className="space-y-10">
          {STAGES.map((s, i) => (
            <Stage key={s} n={i + 1} s={s} visual={visuals[s]} />
          ))}
        </ol>
        <Link to="/carbon-method" className={`${LINK_BTN} border border-green-700 text-green-700`}>
          {t('site.how.seeMethod')}
        </Link>
      </Band>
    </PublicLayout>
  );
}
