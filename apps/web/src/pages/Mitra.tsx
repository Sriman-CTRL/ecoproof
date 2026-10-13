import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { ArrowSquareOut } from '@phosphor-icons/react/dist/csr/ArrowSquareOut';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { BUTTON_CLASS, Button } from '../components/kit/Button';
import { Card, CARD_CLASS } from '../components/kit/Card';
import { Skeleton } from '../components/kit/Skeleton';
import { StatusPill, type PillTone } from '../components/kit/StatusPill';
import { ErrorBox, Page } from '../components/ui';
import { formatDecimal, formatInr } from '../lib/format';
import {
  packMailto,
  useMitraPage,
  useMitraProof,
  useMitraStep,
  useWomenOwned,
  type Commitment,
  type MitraItem,
  type MitraPage,
  type MitraStatus,
  type PeerCase,
} from '../lib/mitra';
import { milestoneDate } from '../lib/progress';
import { getSession } from '../lib/session';
import type { ZedCard } from '../lib/schemes';

const TONE: Record<MitraStatus, PillTone> = {
  not_started: 'neutral',
  started: 'check',
  done_self: 'positive',
  confirmed: 'positive',
};

const monthText = (iso: string, lang: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(lang === 'te' ? 'te-IN' : 'en-IN', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

function ExtLink({
  href,
  children,
  onClick,
  primary = false,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
  primary?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={
        primary
          ? `${BUTTON_CLASS.primary}`
          : 'inline-flex min-h-12 items-center gap-1 font-semibold text-green-700 underline underline-offset-4'
      }
    >
      {children}
      <ArrowSquareOut size={16} aria-hidden="true" />
    </a>
  );
}

/** Progress dots: one per free step, filled when done. Never goes backwards. */
function Dots({ done, total }: { done: number; total: number }) {
  return (
    <span className="flex gap-1.5" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-3 w-3 rounded-full ${i < done ? 'bg-green-700' : 'border border-line bg-surface'}`}
        />
      ))}
    </span>
  );
}

function ZedLine({ z }: { z: ZedCard }) {
  const { t } = useTranslation();
  const women = useWomenOwned();
  return (
    <div className="space-y-2 rounded-card border p-3" data-testid="mitra-zed">
      <p className="font-semibold">{t('mitra.zed.reward', { inr: formatInr(z.rewardInr) })}</p>
      <p className="text-small" data-testid="mitra-zed-subsidy">
        {z.womenOwned && z.womenOwnedLine
          ? z.womenOwnedLine
          : z.subsidyPct != null && z.udyamCategory
            ? t('schemes.zed.subsidy', {
                pct: z.subsidyPct,
                size: t(`schemes.size.${z.udyamCategory}`),
              })
            : t('schemes.zed.subsidyUnknown')}
        {z.scStApplied && ` ${t('schemes.zed.extraApplied', { pct: z.scStExtraPct })}`}
      </p>
      <label className="flex min-h-12 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          className="h-5 w-5 accent-green-700"
          checked={z.womenOwned}
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
    </div>
  );
}

function CommitmentBlock({ c, lang }: { c: Commitment | null; lang: string }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <p className="font-semibold">{t('mitra.commitment.pledgesTitle')}</p>
      <ul className="list-disc space-y-1 pl-5 text-small">
        {(['pledge1', 'pledge2', 'pledge3'] as const).map((k) => (
          <li key={k}>“{t(`mitra.commitment.${k}`)}”</li>
        ))}
      </ul>
      {c ? (
        <div className="rounded-card bg-green-50 p-3" data-testid="commitment-number">
          <p className="num font-heading text-card-title font-semibold">
            {t('mitra.commitment.yourNumber', {
              baseline: formatDecimal(c.baselineT),
              half: formatDecimal(c.halfT),
              year: c.targetYear,
            })}
          </p>
          <p className="text-small text-ink-muted">
            {t('mitra.commitment.basis', {
              from: monthText(c.periodFrom, lang),
              to: monthText(c.periodTo, lang),
              label: c.label,
            })}
          </p>
        </div>
      ) : (
        <p className="text-small text-ink-muted">{t('mitra.commitment.noBills')}</p>
      )}
    </div>
  );
}

export function PeerCaseCard({ p }: { p: PeerCase }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1 rounded-card border p-3" data-testid="peer-case">
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
      <ExtLink href={p.sourceUrl}>{p.page ? `${p.source}, ${p.page}` : p.source}</ExtLink>
    </div>
  );
}

const PROOF_TYPES = ['organiser_email', 'organiser_document', 'attendance_photo'] as const;

/** Upload proof (or, in Demo mode, a clearly labelled sample) -> Certificate of Participation. */
function ProofBlock({ code }: { code: string }) {
  const { t } = useTranslation();
  const proof = useMitraProof();
  const [file, setFile] = useState<File | null>(null);
  const [proofType, setProofType] = useState<string>('attendance_photo');
  const [eventDate, setEventDate] = useState('');
  const demo = !!getSession()?.demo;
  const input = 'mt-1 min-h-12 w-full rounded-button border bg-surface px-3 text-body';
  return (
    <div className="space-y-2 rounded-card border border-green-700 p-3" data-testid="mitra-proof">
      <p className="font-semibold">{t('mitra.cert.uploadTitle')}</p>
      <p className="text-small text-ink-muted">{t('mitra.cert.uploadHelp')}</p>
      <label className="block text-small">
        <span className="font-semibold">{t('mitra.cert.proofType')}</span>
        <select className={input} value={proofType} onChange={(e) => setProofType(e.target.value)}>
          {PROOF_TYPES.map((k) => (
            <option key={k} value={k}>
              {t(`mitra.cert.types.${k}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-small">
        <span className="font-semibold">{t('mitra.cert.eventDate')}</span>
        <input
          type="date"
          className={input}
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
        />
      </label>
      <label className="block text-small">
        <span className="font-semibold">{t('mitra.cert.pickFile')}</span>
        <input
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          className="mt-1 block min-h-12 w-full text-small"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <Button
        disabled={!file || proof.isPending}
        onClick={() => file && proof.mutate({ code, file, proofType, eventDate })}
      >
        {proof.isPending ? t('mitra.cert.uploading') : t('mitra.cert.upload')}
      </Button>
      {demo && (
        <>
          <Button
            variant="secondary"
            disabled={proof.isPending}
            onClick={() => proof.mutate({ code, sample: true })}
            data-testid="mitra-sample-proof"
          >
            {t('mitra.cert.sample')}
          </Button>
          <p className="text-small text-copper-800">{t('mitra.cert.sampleHelp')}</p>
        </>
      )}
      {proof.isError && <ErrorBox>{t('mitra.actionFailed')}</ErrorBox>}
    </div>
  );
}

function StepCard({
  item,
  commitment,
  zed,
  peerCases,
  lang,
}: {
  item: MitraItem;
  commitment: Commitment | null;
  zed: ZedCard | null;
  peerCases: PeerCase[];
  lang: string;
}) {
  const { t } = useTranslation();
  const step = useMitraStep();
  const start = () => step.mutate({ code: item.code, to: 'start' });
  const done = () => step.mutate({ code: item.code, to: 'done' });
  const finished = item.status === 'done_self' || item.status === 'confirmed';

  return (
    <Card id={`mitra-${item.code}`} className="scroll-mt-20 space-y-3" data-testid="mitra-card">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone="positive">{t('mitra.free')}</StatusPill>
        <StatusPill tone={TONE[item.status]}>
          {item.status !== 'not_started' && <CheckCircle size={14} aria-hidden="true" />}
          {t(`mitra.status.${item.status}`)}
        </StatusPill>
      </div>
      <h2 className="font-heading text-card-title font-semibold">{item.title}</h2>
      <p className="text-small text-ink-muted">{t('mitra.runBy', { runBy: item.runBy })}</p>
      <p>
        <span className="font-semibold">{t('mitra.youGet')}</span> {item.freeHelp}
      </p>
      <p className="rounded-card bg-green-50 p-2">
        <span className="font-semibold">{t('mitra.goodForBusiness')}</span> {item.businessGain}
      </p>
      {item.carbonLine && (
        <p className="text-small">
          <span className="font-semibold">{t('mitra.forClimate')}</span> {item.carbonLine}
        </p>
      )}
      <p className="text-small">
        <span className="font-semibold">{t('mitra.howToStart')}</span> {item.howToStart}
      </p>
      {item.datesUnconfirmed && (
        <p className="text-small font-semibold text-copper-800">{t('mitra.checkDates')}</p>
      )}

      {item.code === 'zed_pledge' && zed && <ZedLine z={zed} />}
      {item.kind === 'commitment' && <CommitmentBlock c={commitment} lang={lang} />}
      {item.kind === 'learn' && (
        <div className="space-y-2">
          {peerCases.map((p) => (
            <PeerCaseCard key={p.code} p={p} />
          ))}
        </div>
      )}
      {item.kind === 'visit' && (item.address || item.contactPhone || item.contactEmail) && (
        <ul className="space-y-1 text-small">
          {item.address && <li>{t('mitra.address', { address: item.address })}</li>}
          {item.contactPhone && (
            <li>
              <a
                href={`tel:${item.contactPhone.replace(/[^\d+]/g, '')}`}
                className="inline-flex min-h-12 items-center font-semibold text-green-700 underline underline-offset-4"
              >
                {t('mitra.call', { phone: item.contactPhone })}
              </a>
            </li>
          )}
          {item.contactEmail && (
            <li>
              <a
                href={`mailto:${item.contactEmail}`}
                className="inline-flex min-h-12 items-center font-semibold break-all text-green-700 underline underline-offset-4"
              >
                {t('mitra.email', { email: item.contactEmail })}
              </a>
            </li>
          )}
        </ul>
      )}

      {!finished && (
        <div className="flex flex-col gap-2">
          {item.kind === 'link' && item.url && (
            <ExtLink href={item.url} onClick={start} primary>
              {t('mitra.open')}
            </ExtLink>
          )}
          {item.kind === 'commitment' && item.url && (
            <ExtLink href={item.url} onClick={start} primary>
              {t('mitra.commitment.openForm')}
            </ExtLink>
          )}
          {item.kind === 'visit' && item.status === 'not_started' && (
            <Button onClick={start} disabled={step.isPending}>
              {item.code === 'cbit_student_visit' ? t('mitra.askVisit') : t('mitra.contacted')}
            </Button>
          )}
          {item.kind === 'handoff' && !item.requestPack && (
            <Button onClick={start} disabled={step.isPending} data-testid="mitra-prepare-pack">
              {step.isPending ? t('mitra.pack.preparing') : t('mitra.pack.prepare')}
            </Button>
          )}
          {item.kind === 'handoff' && item.requestPack && (
            <div className="space-y-2 rounded-card bg-green-50 p-3" data-testid="mitra-pack">
              <p className="font-semibold">{t('mitra.pack.ready')}</p>
              <Link
                to={`/reports/${item.requestPack.reportId}`}
                className="inline-flex min-h-12 items-center font-semibold text-green-700 underline underline-offset-4"
              >
                {t('mitra.pack.open')}
              </Link>
              <a
                href={packMailto(item.requestPack)}
                className={BUTTON_CLASS.primary}
                data-testid="mitra-mailto"
              >
                {t('mitra.pack.email')}
              </a>
              <p className="text-small text-ink-muted">{t('mitra.pack.emailHelp')}</p>
            </div>
          )}
          <Button
            variant="secondary"
            onClick={done}
            disabled={step.isPending}
            data-testid="mitra-done"
          >
            {item.kind === 'commitment'
              ? t('mitra.commitment.made')
              : item.kind === 'learn'
                ? t('mitra.readThis')
                : item.kind === 'handoff'
                  ? t('mitra.handoff.sent')
                  : t('mitra.didThis')}
          </Button>
        </div>
      )}
      {item.status === 'done_self' && (
        <p className="flex items-center gap-1 text-small font-semibold text-green-700">
          <CheckCircle size={16} aria-hidden="true" /> {t('mitra.doneBadge')}
        </p>
      )}
      {(item.status === 'started' || item.status === 'done_self') && (
        <ProofBlock code={item.code} />
      )}
      {item.status === 'confirmed' && item.certificateReportId && (
        <Link
          to={`/reports/${item.certificateReportId}`}
          className={BUTTON_CLASS.primary}
          data-testid="mitra-certificate"
        >
          {t('mitra.cert.open')}
          <ArrowRight size={20} aria-hidden="true" />
        </Link>
      )}
      {step.isError && <ErrorBox>{t('mitra.actionFailed')}</ErrorBox>}

      <p className="flex flex-wrap items-center gap-x-3 text-small text-ink-muted">
        <ExtLink href={item.sourceUrl}>{t('mitra.source')}</ExtLink>
        <span>{t('mitra.checked', { date: milestoneDate(item.lastChecked, lang) })}</span>
      </p>
    </Card>
  );
}

export default function Mitra() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const param = useParams().page;
  const page: MitraPage | null = param === 'ngo' || param === 'govt' ? param : null;
  const q = useMitraPage(page ?? 'ngo');
  if (!page) return <Navigate to="/reports" replace />;
  const v = q.data;
  const other: MitraPage = page === 'ngo' ? 'govt' : 'ngo';

  return (
    <Page tab="reports">
      <h1 className="font-heading text-title font-semibold">{t(`mitra.${page}.cardTitle`)}</h1>
      <p className="text-body font-semibold">{t('mitra.lead')}</p>
      {q.isLoading && <Skeleton />}
      {q.isError && <ErrorBox>{t('mitra.loadFailed')}</ErrorBox>}
      {v && (
        <>
          <div className="flex flex-wrap items-center gap-3" data-testid="mitra-progress">
            <Dots done={v.doneCount} total={v.totalCount} />
            <span className="num text-small">
              {t('mitra.progress', { done: v.doneCount, total: v.totalCount })}
            </span>
          </div>
          {v.nextStep ? (
            <a
              href={`#mitra-${v.nextStep.code}`}
              className={BUTTON_CLASS.primary}
              data-testid="mitra-next"
            >
              {t('mitra.nextButton', { title: v.nextStep.title })}
              <ArrowRight size={20} aria-hidden="true" />
            </a>
          ) : (
            <p className="font-semibold text-green-700">{t('mitra.allDone')}</p>
          )}
          <div className="grid gap-3 lg:grid-cols-2 lg:gap-6">
            {v.items.map((item) => (
              <StepCard
                key={item.code}
                item={item}
                commitment={v.commitment}
                zed={v.zed}
                peerCases={v.peerCases}
                lang={lang}
              />
            ))}
          </div>
          <Link
            to={`/mitra/${other}`}
            className={`${CARD_CLASS} flex min-h-12 items-center justify-between gap-2`}
          >
            <span className="font-semibold">{t(`mitra.otherPage.${other}`)}</span>
            <ArrowRight size={20} className="shrink-0 text-green-700" aria-hidden="true" />
          </Link>
          <p className="text-small text-ink-muted" data-testid="mitra-not-part">
            {v.notPartLine}
          </p>
        </>
      )}
    </Page>
  );
}
