import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { BUTTON_CLASS } from '../components/kit/Button';
import { Card } from '../components/kit/Card';
import { prefersReducedMotion } from '../components/kit/motion';
import { Skeleton } from '../components/kit/Skeleton';
import { StampBadge } from '../components/kit/StampBadge';
import { ErrorBox, Page } from '../components/ui';
import {
  milestoneDate,
  nextText,
  useProgress,
  type Progress as ProgressData,
} from '../lib/progress';

const SEEN_KEY = 'ecoproof.progress.stamped';

/**
 * Stages reached for the first time in this browser session play the stamp press once.
 * sessionStorage can be missing or throw (private mode): then nothing animates, nothing breaks.
 */
function useFirstReached(stages: ProgressData['stages'] | undefined): Set<number> {
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (!stages) return;
    const reached = stages.filter((s) => s.reached).map((s) => s.n);
    let seen: number[] = [];
    try {
      seen = JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? '[]') as number[];
    } catch {
      return;
    }
    const now = reached.filter((n) => !seen.includes(n));
    if (now.length === 0) return;
    try {
      sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen, ...now]));
    } catch {
      return;
    }
    if (!prefersReducedMotion()) setFresh(new Set(now));
  }, [stages]);
  return fresh;
}

/** The 5-stage path large, each stage with its Doc 04 milestones and what it unlocks (plan 4). */
export default function Progress() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const q = useProgress();
  const p = q.data;
  const fresh = useFirstReached(p?.stages);
  const byKey = new Map(p?.milestones.map((m) => [m.key, m]));

  return (
    <Page
      tab="home"
      action={
        p && (
          <Link to={p.next.href} className={BUTTON_CLASS.primary} data-testid="primary-next">
            {nextText(p.next, t)}
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
        )
      }
    >
      <h1 className="font-heading text-title font-semibold">{t('progress.title')}</h1>
      {q.isLoading && (
        <>
          <Skeleton />
          <Skeleton />
        </>
      )}
      {q.isError && <ErrorBox>{t('progress.loadFailed')}</ErrorBox>}
      {p && (
        <>
          <p className="text-body">
            {p.stage > 0
              ? t('progress.youAreAt', { stage: t(`kit.path.stage.${p.stages[p.stage - 1]!.key}`) })
              : t('progress.notStarted')}
          </p>
          <ol className="space-y-3">
            {p.stages.map((s) => {
              const current = s.n === p.stage;
              return (
                <li key={s.n} data-testid={`stage-${s.n}`}>
                  <Card
                    className={`space-y-2 ${current ? 'border-2 border-green-700' : ''} ${s.reached ? '' : 'bg-paper'}`}
                    aria-current={current ? 'step' : undefined}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h2 className="flex items-center gap-2 font-heading text-card-title font-semibold">
                        <span
                          aria-hidden="true"
                          className={`flex size-8 shrink-0 items-center justify-center rounded-chip border-2 ${
                            s.reached
                              ? 'border-green-700 bg-green-700 text-white'
                              : 'border-line bg-surface text-ink-muted'
                          }`}
                        >
                          {s.reached ? <Check size={16} weight="bold" /> : s.n}
                        </span>
                        {t(`kit.path.stage.${s.key}`)}
                      </h2>
                      {s.reached && <StampBadge variant="reached" press={fresh.has(s.n)} />}
                    </div>
                    {current && (
                      <p className="inline-block rounded-button bg-green-50 px-2 py-0.5 text-small font-semibold text-green-700">
                        {t('kit.path.here')}
                      </p>
                    )}
                    <ul className="space-y-1">
                      {s.milestones.map((k) => {
                        const m = byKey.get(k);
                        return (
                          <li key={k} className="flex flex-wrap justify-between gap-x-3 text-small">
                            <span>{t(`progress.milestone.${k}`)}</span>
                            <span
                              className={`num ${m?.reachedAt ? 'font-semibold text-green-700' : 'text-ink-muted'}`}
                            >
                              {m?.reachedAt
                                ? milestoneDate(m.reachedAt, lang)
                                : k === 'buyer_approved'
                                  ? t('progress.comingSoon')
                                  : t('progress.notYet')}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    {s.key === 'saving' && s.reached && (
                      <Link
                        to="/savings"
                        className="inline-flex min-h-12 items-center gap-1 font-semibold text-green-700 underline underline-offset-4"
                      >
                        {t('savings.open')}
                        <ArrowRight size={16} aria-hidden="true" />
                      </Link>
                    )}
                    <p className="text-small text-ink-muted">
                      {t(s.reached ? 'progress.unlocked' : 'progress.unlocks', {
                        what: t(`progress.unlock.${s.unlocks}`),
                      })}
                    </p>
                  </Card>
                </li>
              );
            })}
          </ol>
          <p
            className="rounded-card bg-paper p-3 text-small text-ink-muted"
            data-testid="cluster-note"
          >
            <span className="font-semibold text-ink">{t('progress.cluster.title')}</span>{' '}
            {t('progress.cluster.note')}
          </p>
          <p className="text-small text-ink-muted">{t('progress.datesNote')}</p>
        </>
      )}
    </Page>
  );
}
