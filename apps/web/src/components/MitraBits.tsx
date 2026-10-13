import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { ArrowSquareOut } from '@phosphor-icons/react/dist/csr/ArrowSquareOut';
import { useMitraSummary, usePeerCases, useWomenOwned, type PeerCase } from '../lib/mitra';
import { CARD_CLASS } from './kit/Card';
import { ErrorBox } from './ui';

/** A published foundry case (UNIDO): never an EcoProof customer, quoted with its source. */
export function PeerCaseCard({ p }: { p: PeerCase }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1 rounded-card border bg-surface p-3" data-testid="peer-case">
      <p className="font-semibold">
        {p.company}, {p.place}
      </p>
      <p className="text-small font-semibold text-copper-800">{t('mitra.peer.label')}</p>
      <p>{p.measure}</p>
      <ul className="num space-y-0.5 text-small">
        <li>{t('mitra.peer.invest', { text: p.investmentText })}</li>
        {p.savingText && <li>{t('mitra.peer.saving', { text: p.savingText })}</li>}
        <li>{t('mitra.peer.payback', { text: p.paybackText })}</li>
        {p.beforeAfterText && <li>{t('mitra.peer.beforeAfter', { text: p.beforeAfterText })}</li>}
      </ul>
      <p className="text-small text-ink-muted">“{p.quotedLine}”</p>
      <a
        href={p.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-12 items-center gap-1 text-small font-semibold text-green-700 underline underline-offset-4"
      >
        {p.page ? `${p.source}, ${p.page}` : p.source}
        <ArrowSquareOut size={16} aria-hidden="true" />
      </a>
    </div>
  );
}

/** Owner-entered "woman-owned unit" flag: switches the ZED subsidy line live. */
export function WomenOwnedToggle({ checked }: { checked: boolean }) {
  const { t } = useTranslation();
  const women = useWomenOwned();
  return (
    <>
      <label className="flex min-h-12 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          className="h-5 w-5 accent-green-700"
          checked={checked}
          disabled={women.isPending}
          onChange={(e) => women.mutate(e.target.checked)}
          data-testid="women-owned-toggle"
        />
        <span>
          <span className="block font-semibold">{t('mitra.zed.womenToggle')}</span>
          <span className="block text-small text-ink-muted">{t('mitra.zed.womenHelp')}</span>
        </span>
      </label>
      {women.isError && <ErrorBox>{t('mitra.actionFailed')}</ErrorBox>}
    </>
  );
}

/** Home: one line to the next free Mitra step, or the follow-up nudge for a step left "started". */
export function MitraHomeLine() {
  const { t } = useTranslation();
  const q = useMitraSummary();
  const s = q.data;
  if (!s || (!s.followUp && !s.next)) return null;
  const to = s.followUp ? `/mitra/${s.followUp.page}` : `/mitra/${s.next!.page}`;
  return (
    <Link
      to={to}
      className={`${CARD_CLASS} flex min-h-12 items-center justify-between gap-2`}
      data-testid={s.followUp ? 'mitra-follow-up' : 'mitra-next-line'}
    >
      <span className="font-semibold">
        {s.followUp
          ? t('mitra.home.followUp', { runBy: s.followUp.runBy })
          : t('mitra.home.next', { title: s.next!.title })}
      </span>
      <ArrowRight size={20} className="shrink-0 text-green-700" aria-hidden="true" />
    </Link>
  );
}

/** ActionDetail: published foundry cases for this action, if any. */
export function ActionPeerCases({ actionCode }: { actionCode: string }) {
  const { t } = useTranslation();
  const q = usePeerCases(actionCode);
  if (!q.data?.length) return null;
  return (
    <section className="space-y-2" data-testid="action-peer-cases">
      <h2 className="font-heading text-card-title font-semibold">{t('mitra.actionPeer')}</h2>
      {q.data.map((p) => (
        <PeerCaseCard key={p.code} p={p} />
      ))}
    </section>
  );
}
