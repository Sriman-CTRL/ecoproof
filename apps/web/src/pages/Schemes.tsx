import { useTranslation } from 'react-i18next';
import { ArrowSquareOut } from '@phosphor-icons/react/dist/csr/ArrowSquareOut';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { BUTTON_CLASS } from '../components/kit/Button';
import { Card } from '../components/kit/Card';
import { Skeleton } from '../components/kit/Skeleton';
import { StatusPill, type PillTone } from '../components/kit/StatusPill';
import { ErrorBox, Page } from '../components/ui';
import { formatInr } from '../lib/format';
import { useSchemes, type SchemeMatch, type SchemeStatus, type ZedCard } from '../lib/schemes';

const TONE: Record<SchemeStatus, PillTone> = {
  likely: 'positive',
  check_lender: 'check',
  check_office: 'check',
  not_eligible: 'neutral',
};
const ORDER: SchemeStatus[] = ['likely', 'check_lender', 'check_office', 'not_eligible'];

const dateText = (iso: string, lang: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(lang === 'te' ? 'te-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-12 items-center gap-1 text-small font-semibold text-green-700 underline underline-offset-4"
    >
      {children}
      <ArrowSquareOut size={16} aria-hidden="true" />
    </a>
  );
}

/** Rules not checked for 60+ days (Doc 02 FIN-1): a warning, not an error. */
function StaleNote() {
  const { t } = useTranslation();
  return (
    <p className="flex gap-2 rounded-card border border-copper-700 bg-copper-50 p-2 text-small text-copper-800">
      <Warning size={18} className="mt-px shrink-0" aria-hidden="true" />
      {t('schemes.stale')}
    </p>
  );
}

function Checked({ m, lang }: { m: { lastChecked: string | null; stale: boolean }; lang: string }) {
  const { t } = useTranslation();
  return (
    <>
      <p className="text-small text-ink-muted">
        {m.lastChecked
          ? t('schemes.lastChecked', { date: dateText(m.lastChecked, lang) })
          : t('schemes.neverChecked')}
      </p>
      {m.stale && <StaleNote />}
    </>
  );
}

function ZedReadiness({ z, lang }: { z: ZedCard; lang: string }) {
  const { t } = useTranslation();
  const levels = ['bronze', 'silver', 'gold'] as const;
  return (
    <Card className="space-y-3" data-testid="zed-card">
      <h2 className="font-heading text-card-title font-semibold">{t('schemes.zed.title')}</h2>
      <StatusPill tone={TONE[z.status]}>{t(`schemes.status.${z.status}`)}</StatusPill>
      <p>{t('schemes.zed.lead', { inr: formatInr(z.rewardInr) })}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-small">
        {levels.map((l) => (
          <div key={l} className="contents">
            <dt className="text-ink-muted">{t(`schemes.zed.level.${l}`)}</dt>
            <dd className="num">
              {l === 'bronze'
                ? t('schemes.zed.bronzeFee', { inr: formatInr(z.feesInr.bronze) })
                : formatInr(z.feesInr[l])}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-small">
        {z.subsidyPct != null && z.udyamCategory
          ? t('schemes.zed.subsidy', {
              pct: z.subsidyPct,
              size: t(`schemes.size.${z.udyamCategory}`),
            })
          : t('schemes.zed.subsidyUnknown')}
        {z.womenScStApplied && ` ${t('schemes.zed.extraApplied', { pct: z.womenScStExtraPct })}`}
      </p>
      <p className="text-small text-ink-muted">{z.rewardNote}</p>

      <h3 className="font-heading font-semibold">{t('schemes.zed.banksTitle')}</h3>
      <ul className="space-y-2" data-testid="zed-banks">
        {z.bankConcessions.map((b) => (
          <li key={b.bank} className="rounded-card border p-2">
            <p className="font-semibold">{b.bank}</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-small">
              {levels.map((l) => (
                <div key={l} className="contents">
                  <dt className="text-ink-muted">{t(`schemes.zed.level.${l}`)}</dt>
                  <dd>{b[l]}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      <p className="text-small text-copper-800">{t('schemes.zed.recheck')}</p>
      <p className="text-small text-ink-muted">{z.bankNote}</p>
      <div className="flex flex-wrap gap-x-4">
        {z.sourceUrl && <SourceLink href={z.sourceUrl}>{t('schemes.zed.source')}</SourceLink>}
        <SourceLink href={z.bankSourceUrl}>{t('schemes.zed.bankSource')}</SourceLink>
      </div>
      <Checked m={z} lang={lang} />
    </Card>
  );
}

function MatchCard({ m, lang }: { m: SchemeMatch; lang: string }) {
  const { t } = useTranslation();
  return (
    <Card className="space-y-2" data-testid="scheme-row">
      <h3 className="font-heading font-semibold">{m.name}</h3>
      <StatusPill tone={TONE[m.status]}>
        {m.status === 'not_eligible'
          ? t('schemes.notEligible', { reason: m.reason })
          : t(`schemes.status.${m.status}`)}
      </StatusPill>
      {m.status !== 'not_eligible' && <p className="text-small">{m.reason}</p>}
      {m.benefit && <p className="text-small text-ink-muted">{m.benefit}</p>}
      {m.sourceUrl && <SourceLink href={m.sourceUrl}>{t('schemes.source')}</SourceLink>}
      <Checked m={m} lang={lang} />
    </Card>
  );
}

/** FIN-1 scheme matcher, ZED readiness card first, money found counter on top (plan 4, 6.2). */
export default function Schemes() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const q = useSchemes();
  const v = q.data;
  const others = v ? v.matches.filter((m) => m.code !== 'zed_joining_reward') : [];
  const top = v?.topMatch?.sourceUrl;

  return (
    <Page
      tab="plan"
      action={
        top ? (
          <a
            href={top}
            target="_blank"
            rel="noopener noreferrer"
            className={`${BUTTON_CLASS.primary} w-full`}
            data-testid="primary-top-match"
          >
            {t('schemes.openTop')}
            <ArrowSquareOut size={20} aria-hidden="true" />
          </a>
        ) : undefined
      }
    >
      <h1 className="font-heading text-title font-semibold">{t('schemes.title')}</h1>
      {q.isLoading && (
        <>
          <Skeleton />
          <Skeleton />
        </>
      )}
      {q.isError && <ErrorBox>{t('schemes.loadFailed')}</ErrorBox>}
      <div className="grid gap-3 lg:grid-cols-12 lg:items-start lg:gap-6">
        <div className="space-y-3 lg:col-span-6 lg:space-y-6">
          {v && v.moneyFound.inr > 0 && (
            <Card className="space-y-1" data-testid="money-found">
              <p className="font-heading text-card-title font-semibold">
                {t('schemes.moneyFound', {
                  inr: formatInr(v.moneyFound.inr),
                  items: v.moneyFound.items
                    .map((i) => t(`schemes.money.${i.code}`, { defaultValue: i.label }))
                    .join(', '),
                })}
              </p>
              <p className="text-small text-ink-muted">{t('schemes.status.likely')}</p>
            </Card>
          )}
          {v?.zed && <ZedReadiness z={v.zed} lang={lang} />}
        </div>
        <div className="space-y-3 lg:col-span-6">
          {ORDER.map((s) => {
            const group = others.filter((m) => m.status === s);
            if (!group.length) return null;
            return (
              <section key={s} className="space-y-2">
                <h2 className="font-heading text-card-title font-semibold">
                  {t(`schemes.group.${s}`)}
                </h2>
                {group.map((m) => (
                  <MatchCard key={m.code} m={m} lang={lang} />
                ))}
              </section>
            );
          })}
        </div>
      </div>
      <p className="text-small text-ink-muted">{t('schemes.footnote')}</p>
    </Page>
  );
}
