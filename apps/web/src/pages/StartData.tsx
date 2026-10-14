import { SAMPLE_GSTIN, SAMPLE_UDYAM_NO } from '@ecoproof/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BusinessLadder, CheckList, MonthStrip, SampleTag } from '../components/DataBits';
import { Button } from '../components/kit/Button';
import { Card } from '../components/kit/Card';
import { Skeleton } from '../components/kit/Skeleton';
import { StatusPill } from '../components/kit/StatusPill';
import { ErrorBox, monthLabel, Page } from '../components/ui';
import { api, postJson } from '../lib/api';
import {
  STRENGTH_TONE,
  type BusinessView,
  type DataMonths,
  type DocChecks,
  type MonthCard,
  type MonthHistory,
  type OnboardingView,
  type WizardState,
} from '../lib/dataIntake';
import { describeError } from '../lib/errors';
import { formatNumber } from '../lib/format';
import { getSession } from '../lib/session';

const INPUT =
  'min-h-12 w-full rounded-button border border-line bg-surface px-3 text-body [overflow-wrap:anywhere]';

const putState = (siteId: string, s: WizardState) =>
  api<{ state: WizardState }>(`/sites/${siteId}/onboarding`, {
    method: 'PUT',
    body: JSON.stringify(s),
  });

function Field({
  label,
  sample,
  children,
}: {
  label: string;
  sample?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="flex flex-wrap items-center gap-2 text-small font-semibold">
        {label}
        {sample && <SampleTag />}
      </span>
      {children}
    </label>
  );
}

// ------------------------------------------------------------------ step 1

function BusinessStep({
  siteId,
  view,
  onChange,
}: {
  siteId: string;
  view: OnboardingView;
  onChange: (b: BusinessView) => void;
}) {
  const { t } = useTranslation();
  const b = view.business;
  const [udyam, setUdyam] = useState(b.saved ? (b.numbers.udyamNo ?? '') : '');
  const [gstin, setGstin] = useState(b.saved ? (b.numbers.gstin ?? '') : '');
  const [consumer, setConsumer] = useState(b.saved ? (b.numbers.consumerNo ?? '') : '');
  const [sample, setSample] = useState(Boolean(view.state.sample?.business));

  const check = useMutation({
    mutationFn: () =>
      postJson<BusinessView>(`/sites/${siteId}/business-check`, {
        udyamNo: udyam,
        gstin: gstin || null,
        consumerNo: consumer,
        sample,
      }),
    onSuccess: (r) => {
      onChange(r);
      void putState(siteId, { sample: { business: sample } });
    },
  });
  const upload = useMutation({
    mutationFn: (file: File | null) => {
      if (!file)
        return postJson<BusinessView>(`/sites/${siteId}/business-check/udyam-certificate`, {
          sample: true,
        });
      const fd = new FormData();
      fd.append('file', file);
      return api<BusinessView>(`/sites/${siteId}/business-check/udyam-certificate`, {
        method: 'POST',
        body: fd,
      });
    },
    onSuccess: onChange,
  });

  return (
    <div className="space-y-3">
      <Card className="space-y-3">
        <p className="text-small text-ink-muted">{t('data.business.intro')}</p>
        <Field label={t('data.business.udyam')} sample={sample}>
          <input
            className={`${INPUT} num uppercase`}
            value={udyam}
            onChange={(e) => {
              setUdyam(e.target.value);
              setSample(false);
            }}
            placeholder="UDYAM-XX-00-0000000"
            data-testid="udyam-input"
          />
        </Field>
        <Field label={t('data.business.gstin')} sample={sample}>
          <input
            className={`${INPUT} num uppercase`}
            value={gstin}
            maxLength={15}
            onChange={(e) => {
              setGstin(e.target.value);
              setSample(false);
            }}
          />
        </Field>
        <Field label={t('data.business.consumer')} sample={sample}>
          <input
            className={`${INPUT} num`}
            value={consumer}
            onChange={(e) => {
              setConsumer(e.target.value);
              setSample(false);
            }}
          />
        </Field>
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button
            disabled={!udyam || !consumer || check.isPending}
            onClick={() => check.mutate()}
            data-testid="business-check"
          >
            {t('data.business.check')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setUdyam(SAMPLE_UDYAM_NO);
              setGstin(SAMPLE_GSTIN);
              setConsumer('SAMPLE-HT-0001');
              setSample(true);
            }}
          >
            {t('data.fillSample')}
          </Button>
        </div>
        {check.isError && <ErrorBox>{describeError(check.error, t)}</ErrorBox>}
      </Card>

      {b.checks.length > 0 && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-card-title font-semibold">
              {t('data.business.level')}
            </h2>
            <StatusPill tone={b.levelNumber > 0 ? 'positive' : 'check'}>{b.levelText}</StatusPill>
          </div>
          <CheckList checks={b.checks} labelKey="data.business.codes" />
        </Card>
      )}

      <Card className="space-y-3">
        <h2 className="font-heading text-card-title font-semibold">
          {t('data.business.uploadTitle')}
        </h2>
        <p className="text-small text-ink-muted">{t('data.business.uploadHelp')}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-button border border-green-700 px-4 font-semibold text-green-700">
            {t('data.business.uploadButton')}
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              disabled={b.level === 'none' || upload.isPending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload.mutate(f);
              }}
            />
          </label>
          <Button
            variant="secondary"
            className="flex-1"
            disabled={b.level === 'none' || upload.isPending}
            onClick={() => upload.mutate(null)}
            data-testid="udyam-sample"
          >
            {t('data.business.uploadSample')}
          </Button>
        </div>
        {view.samples.isDemo && (
          <p className="text-small text-copper-800">{t('data.business.sampleRead')}</p>
        )}
        {upload.isError && <ErrorBox>{describeError(upload.error, t)}</ErrorBox>}
        {b.doc && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-card bg-paper p-3 text-small">
            <dt className="col-span-2 flex items-center gap-2 font-semibold">
              {t('data.business.readTitle')} {b.doc.isSample && <SampleTag />}
            </dt>
            <dt className="text-ink-muted">{t('data.business.readUdyam')}</dt>
            <dd className="num">{b.doc.udyamNo}</dd>
            <dt className="text-ink-muted">{t('data.business.readName')}</dt>
            <dd>{b.doc.enterpriseName}</dd>
            <dt className="text-ink-muted">{t('data.business.readState')}</dt>
            <dd>{b.doc.state}</dd>
            <dt className="text-ink-muted">{t('data.business.readActivity')}</dt>
            <dd>{b.doc.majorActivity}</dd>
          </dl>
        )}
      </Card>

      <Card className="space-y-3">
        <BusinessLadder business={b} />
      </Card>

      <Card className="space-y-2">
        <h2 className="font-heading text-card-title font-semibold">
          {t('data.business.selfTitle')}
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-small">
          <li>
            <a
              className="text-green-700 underline underline-offset-4"
              href="https://udyamregistration.gov.in"
              target="_blank"
              rel="noreferrer"
            >
              {t('data.business.selfUdyam')}
            </a>
          </li>
          <li>
            <a
              className="text-green-700 underline underline-offset-4"
              href="https://www.gst.gov.in"
              target="_blank"
              rel="noreferrer"
            >
              {t('data.business.selfGst')}
            </a>
          </li>
        </ul>
        <p className="text-small text-ink-muted">{t('data.business.selfNote')}</p>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ step 2

function useDocChecks(documentId: string | null | undefined, tonnes: number | null | undefined) {
  return useQuery({
    queryKey: ['doc-checks', documentId, tonnes ?? null],
    enabled: Boolean(documentId),
    queryFn: () =>
      api<DocChecks>(`/documents/${documentId}/checks${tonnes != null ? `?tonnes=${tonnes}` : ''}`),
    refetchInterval: (q) =>
      q.state.data && ['received', 'needs_manual'].includes(q.state.data.status) ? 1500 : false,
  });
}

function BillChecksCard({ checks, highlight }: { checks: DocChecks; highlight?: string }) {
  const { t } = useTranslation();
  const f = checks.fields;
  return (
    <Card className="space-y-3" data-testid="bill-checks">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-card-title font-semibold">
          {t('data.bills.checksTitle')}
        </h2>
        <StatusPill tone={checks.sample ? 'check' : 'neutral'}>{checks.sourceText}</StatusPill>
      </div>
      {f && (
        <p className="num text-small text-ink-muted">
          {monthLabel(f.periodStart, 'en')}: {formatNumber(f.kwh)} kWh · {formatNumber(f.kvah)} kVAh
          · Rs {formatNumber(f.total)}
        </p>
      )}
      <CheckList checks={checks.checks} labelKey="data.bills.codes" />
      <div>
        <h3 className="text-small font-semibold">{t('data.bills.stripTitle')}</h3>
        <MonthStrip strip={checks.strip} highlight={highlight} />
      </div>
      <details className="text-small text-ink-muted">
        <summary className="min-h-12 cursor-pointer py-3 font-semibold text-green-700">
          {t('data.bills.methodTitle')}
        </summary>
        <p>{checks.methodNote}</p>
      </details>
    </Card>
  );
}

function BillsStep({
  siteId,
  state,
  setState,
}: {
  siteId: string;
  state: WizardState;
  setState: (s: WizardState) => void;
}) {
  const { t } = useTranslation();
  const [note, setNote] = useState<string | null>(null);
  const checks = useDocChecks(state.documentId, state.productionTonnes);
  const pick = (documentId: string | null, already = false) => {
    setNote(already ? t('data.bills.alreadyReceived') : null);
    setState({ documentId });
  };
  const sample = useMutation({
    mutationFn: (variant: 'clean' | 'edited') =>
      postJson<{ documentId: string; status: string }>(`/sites/${siteId}/documents/sample`, {
        variant,
      }),
    onSuccess: (r) => pick(r.documentId, r.status === 'already_received'),
  });
  const upload = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api<{ documentId: string; status: string }>(`/sites/${siteId}/documents`, {
        method: 'POST',
        body: fd,
      });
    },
    onSuccess: (r) => pick(r.documentId, r.status === 'already_received'),
  });
  const discard = useMutation({
    mutationFn: (id: string) => postJson(`/documents/${id}/discard`, {}),
    onSuccess: () => {
      setState({ documentId: null });
      setNote(t('data.bills.discarded'));
    },
  });

  return (
    <div className="space-y-3">
      <Card className="space-y-3">
        <p className="text-small text-ink-muted">{t('data.bills.intro')}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            disabled={sample.isPending}
            onClick={() => sample.mutate('clean')}
            data-testid="bill-sample"
          >
            {t('data.bills.useSample')}
          </Button>
          <button
            type="button"
            disabled={sample.isPending}
            onClick={() => sample.mutate('edited')}
            className="inline-flex min-h-12 items-center justify-center rounded-button border border-copper-800 px-4 font-semibold text-copper-800"
            data-testid="bill-edited"
          >
            {t('data.bills.tryEdited')}
          </button>
          <label className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-button border border-green-700 px-4 font-semibold text-green-700">
            {t('data.bills.upload')}
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload.mutate(f);
              }}
            />
          </label>
          <Link
            to="/bills/new"
            className="inline-flex min-h-12 items-center justify-center text-green-700 underline underline-offset-4"
          >
            {t('data.bills.typeIt')}
          </Link>
        </div>
        {(sample.isError || upload.isError) && (
          <ErrorBox>{describeError(sample.error ?? upload.error, t)}</ErrorBox>
        )}
        {note && <p className="text-small font-semibold text-copper-800">{note}</p>}
      </Card>
      {checks.data && ['received', 'needs_manual'].includes(checks.data.status) && (
        <Card>
          <p className="text-small">{t('data.bills.reading')}</p>
          <Skeleton />
        </Card>
      )}
      {checks.data?.fields && (
        <>
          <BillChecksCard checks={checks.data} highlight={checks.data.fields.periodStart} />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-small text-ink-muted">{t('data.bills.keep')}</p>
            <Button
              variant="danger"
              className="sm:w-auto"
              onClick={() => state.documentId && discard.mutate(state.documentId)}
              data-testid="bill-discard"
            >
              {t('data.bills.discard')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ steps 3 and 4

function NumberStep({
  intro,
  label,
  value,
  sample,
  onValue,
  onSample,
  children,
}: {
  intro: string;
  label: string;
  value: number | null | undefined;
  sample: boolean;
  onValue: (n: number | null) => void;
  onSample: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <Card className="space-y-3">
        <p className="text-small text-ink-muted">{intro}</p>
        <Field label={label} sample={sample}>
          <input
            className={`${INPUT} num`}
            inputMode="decimal"
            value={value ?? ''}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d.]/g, '');
              onValue(v === '' ? null : Number(v));
            }}
            data-testid="number-input"
          />
        </Field>
        <Button variant="secondary" onClick={onSample}>
          {t('data.fillSample')}
        </Button>
      </Card>
      {children}
    </div>
  );
}

// ------------------------------------------------------------------ step 5

const VALUE_KEYS = ['kwh', 'kvah', 'mdKva', 'energyCharges', 'demandCharges'] as const;
const VALUE_LABEL: Record<(typeof VALUE_KEYS)[number], string> = {
  kwh: 'data.review.kwh',
  kvah: 'data.review.kvah',
  mdKva: 'data.review.md',
  energyCharges: 'data.review.energy',
  demandCharges: 'data.review.demand',
};

function MonthCardView({ m, onChanged }: { m: MonthCard; onChanged: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const [reasonOpen, setReasonOpen] = useState(false);
  const [lockReason, setLockReason] = useState('');
  const [correcting, setCorrecting] = useState(false);
  const [field, setField] = useState<(typeof VALUE_KEYS)[number]>('kwh');
  const [newValue, setNewValue] = useState('');
  const [reasonKind, setReasonKind] = useState<'reissued' | 'typo' | 'other'>('reissued');
  const [otherReason, setOtherReason] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const history = useQuery({
    queryKey: ['month-history', m.id, m.version],
    enabled: historyOpen,
    queryFn: () => api<MonthHistory>(`/energy-months/${m.id}/history`),
  });
  const lock = useMutation({
    mutationFn: (reason?: string) =>
      postJson(`/energy-months/${m.id}/lock`, reason ? { reason } : {}),
    onSuccess: () => {
      setReasonOpen(false);
      onChanged();
    },
  });
  const reasonText =
    reasonKind === 'reissued'
      ? t('data.review.reasonReissued')
      : reasonKind === 'typo'
        ? t('data.review.reasonTypo')
        : otherReason.trim();
  const correct = useMutation({
    mutationFn: () =>
      postJson(`/energy-months/${m.id}/corrections`, {
        values: { [field]: Number(newValue) },
        reason: reasonText,
      }),
    onSuccess: () => {
      setCorrecting(false);
      setNewValue('');
      setHistoryOpen(true);
      onChanged();
    },
  });
  const second = m.strength === 'second_look';
  const passed = m.checks.filter((c) => c.result === 'pass').length;
  return (
    <Card className="space-y-3" data-testid="month-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-heading text-card-title font-semibold">{monthLabel(m.month, lang)}</h3>
        <div className="flex flex-wrap gap-2">
          {m.lockedAt && <StatusPill tone="neutral">{t('data.review.locked')}</StatusPill>}
          <StatusPill tone={STRENGTH_TONE[m.strength]}>{m.strengthText}</StatusPill>
        </div>
      </div>
      <p className="text-small text-ink-muted">
        {m.sourceText} · {t('data.review.checksPassed', { n: passed, m: m.checks.length })}
        {m.version > 1 && ` · ${t('data.review.version', { n: m.version })}`}
      </p>
      <dl className="num grid grid-cols-2 gap-x-3 gap-y-1 text-small sm:grid-cols-5">
        {VALUE_KEYS.map((k) => (
          <div key={k}>
            <dt className="text-ink-muted">{t(VALUE_LABEL[k])}</dt>
            <dd className="font-semibold">
              {m.values[k] == null ? '-' : formatNumber(m.values[k])}
            </dd>
          </div>
        ))}
      </dl>
      {m.lockReason && <p className="text-small text-copper-800">{m.lockReason}</p>}
      <details>
        <summary className="min-h-12 cursor-pointer py-3 text-small font-semibold text-green-700">
          {t('data.bills.checksTitle')}
        </summary>
        <CheckList checks={m.checks} labelKey="data.bills.codes" />
        {m.fileSha256 && (
          <p className="mt-2 text-[11px] text-ink-muted [overflow-wrap:anywhere]">
            {t('data.review.fileHash')}: <span className="num">{m.fileSha256}</span>
          </p>
        )}
      </details>
      <div className="flex flex-wrap gap-2">
        {!m.lockedAt && (
          <Button
            className="sm:w-auto"
            disabled={lock.isPending}
            onClick={() => (second ? setReasonOpen(true) : lock.mutate(undefined))}
            data-testid="lock-month"
          >
            {t('data.review.lock')}
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() => setCorrecting((c) => !c)}
          data-testid="correct-month"
        >
          {t('data.review.correct')}
        </Button>
        <Button
          variant="secondary"
          onClick={() => setHistoryOpen((h) => !h)}
          data-testid="history-month"
        >
          {t('data.review.history')}
        </Button>
      </div>
      {reasonOpen && (
        <div className="space-y-2 rounded-card bg-copper-50 p-3">
          <Field label={t('data.review.lockReasonLabel')}>
            <input
              className={INPUT}
              value={lockReason}
              onChange={(e) => setLockReason(e.target.value)}
            />
          </Field>
          <Button
            disabled={lockReason.trim().length < 3}
            onClick={() => lock.mutate(lockReason.trim())}
          >
            {t('data.review.lockWithReason')}
          </Button>
        </div>
      )}
      {lock.isError && <ErrorBox>{describeError(lock.error, t)}</ErrorBox>}
      {correcting && (
        <div className="space-y-2 rounded-card bg-paper p-3" data-testid="correction-form">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label={t('data.review.correct')}>
              <select
                className={INPUT}
                value={field}
                onChange={(e) => setField(e.target.value as (typeof VALUE_KEYS)[number])}
              >
                {VALUE_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {t(VALUE_LABEL[k])}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`${t(VALUE_LABEL[field])} (${formatNumber(m.values[field] ?? 0)})`}>
              <input
                className={`${INPUT} num`}
                inputMode="decimal"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value.replace(/[^\d.]/g, ''))}
                data-testid="correction-value"
              />
            </Field>
          </div>
          <fieldset className="space-y-1">
            <legend className="text-small font-semibold">{t('data.review.reason')}</legend>
            {(['reissued', 'typo', 'other'] as const).map((k) => (
              <label key={k} className="flex min-h-12 items-center gap-2 text-small">
                <input
                  type="radio"
                  name={`reason-${m.id}`}
                  checked={reasonKind === k}
                  onChange={() => setReasonKind(k)}
                />
                {t(
                  k === 'reissued'
                    ? 'data.review.reasonReissued'
                    : k === 'typo'
                      ? 'data.review.reasonTypo'
                      : 'data.review.reasonOther',
                )}
              </label>
            ))}
            {reasonKind === 'other' && (
              <input
                className={INPUT}
                placeholder={t('data.review.reasonOtherText')}
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
              />
            )}
          </fieldset>
          <Button
            disabled={!newValue || reasonText.length < 3 || correct.isPending}
            onClick={() => correct.mutate()}
            data-testid="save-correction"
          >
            {t('data.review.saveCorrection')}
          </Button>
          {correct.isError && <ErrorBox>{describeError(correct.error, t)}</ErrorBox>}
        </div>
      )}
      {historyOpen && history.data && (
        <div className="space-y-2 rounded-card border p-3" data-testid="month-history">
          <h4 className="text-small font-semibold">{t('data.review.history')}</h4>
          {history.data.versions.length === 0 ? (
            <p className="text-small text-ink-muted">{t('data.review.noHistory')}</p>
          ) : (
            <ol className="space-y-2">
              {history.data.versions.map((v, i) => {
                const prev = history.data!.versions[i - 1];
                const changed = prev
                  ? VALUE_KEYS.filter((k) => prev.values[k] !== v.values[k])
                  : [];
                return (
                  <li key={v.version} className="text-small">
                    <p className="font-semibold">
                      {t('data.review.version', { n: v.version })} ·{' '}
                      {new Date(v.createdAt).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}{' '}
                      · {v.reason}
                    </p>
                    {changed.map((k) => (
                      <p key={k} className="num text-ink-muted">
                        {t(VALUE_LABEL[k])}: <s>{formatNumber(prev!.values[k] ?? 0)}</s> →{' '}
                        {formatNumber(v.values[k] ?? 0)}
                      </p>
                    ))}
                  </li>
                );
              })}
            </ol>
          )}
          <p className="text-[11px] text-ink-muted">{history.data.note}</p>
        </div>
      )}
    </Card>
  );
}

function ReviewStep({
  siteId,
  state,
  setState,
}: {
  siteId: string;
  state: WizardState;
  setState: (s: WizardState) => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const months = useQuery({
    queryKey: ['data-months', siteId],
    queryFn: () => api<DataMonths>(`/sites/${siteId}/data-months`),
  });
  const pending = useDocChecks(state.documentId, state.productionTonnes);
  const isPending = pending.data?.status === 'extracted';
  const confirm = useMutation({
    mutationFn: async () => {
      const d = await api<{ fields: unknown; validation: { needsConfirmation: string[] } }>(
        `/documents/${state.documentId}`,
      );
      return postJson(`/documents/${state.documentId}/confirm`, {
        fields: d.fields,
        productionTonnes: state.productionTonnes,
        dieselLitres: state.dieselLitres ?? undefined,
        acknowledged: d.validation.needsConfirmation,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['data-months', siteId] });
      void qc.invalidateQueries({ queryKey: ['doc-checks'] });
      setState({});
    },
  });
  const list = months.data?.months ?? [];
  const shown = showAll ? list : list.slice(0, 3);
  return (
    <div className="space-y-3">
      <p className="text-small text-ink-muted">{t('data.review.intro')}</p>
      {isPending && pending.data && (
        <div className="space-y-2">
          <h2 className="font-heading text-card-title font-semibold">{t('data.review.pending')}</h2>
          <BillChecksCard checks={pending.data} highlight={pending.data.fields?.periodStart} />
          {state.productionTonnes == null && (
            <p className="text-small text-copper-800">{t('data.review.confirmNeedsProduction')}</p>
          )}
          <Button
            disabled={state.productionTonnes == null || confirm.isPending}
            onClick={() => confirm.mutate()}
            data-testid="confirm-bill"
          >
            {t('data.review.confirm')}
          </Button>
          {confirm.isError && <ErrorBox>{describeError(confirm.error, t)}</ErrorBox>}
        </div>
      )}
      {months.isLoading && <Skeleton />}
      {months.data && (
        <Card>
          <h2 className="text-small font-semibold">{t('data.bills.stripTitle')}</h2>
          <MonthStrip strip={months.data.strip} />
        </Card>
      )}
      {shown.map((m) => (
        <MonthCardView
          key={m.id}
          m={m}
          onChanged={() => void qc.invalidateQueries({ queryKey: ['data-months', siteId] })}
        />
      ))}
      {!showAll && list.length > 3 && (
        <Button variant="secondary" onClick={() => setShowAll(true)}>
          {t('data.review.showAll', { n: list.length })}
        </Button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ the page

export default function StartData() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const siteId = getSession()?.siteId ?? '';
  const view = useQuery({
    queryKey: ['onboarding', siteId],
    queryFn: () => api<OnboardingView>(`/sites/${siteId}/onboarding`),
  });
  const [state, setLocal] = useState<WizardState>({});
  const [step, setStep] = useState(1);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (view.data && !ready) {
      setLocal(view.data.state);
      setStep(view.data.state.step ?? 1);
      setReady(true);
    }
  }, [view.data, ready]);

  const save = (patch: WizardState) => {
    setLocal((s) => ({ ...s, ...patch, sample: { ...s.sample, ...patch.sample } }));
    void putState(siteId, patch);
  };
  const go = (n: number) => {
    setStep(n);
    save({ step: n });
    window.scrollTo({ top: 0 });
  };
  const finish = useMutation({
    mutationFn: () => postJson(`/sites/${siteId}/onboarding/finish`, {}),
    onSuccess: () => {
      void qc.invalidateQueries();
      navigate('/home');
    },
  });
  const tonnesChecks = useDocChecks(step === 4 ? state.documentId : null, state.productionTonnes);
  const billChecks = useDocChecks(step === 2 ? state.documentId : null, state.productionTonnes);

  if (view.isLoading || !ready) {
    return (
      <Page>
        <Skeleton />
      </Page>
    );
  }
  if (view.isError || !view.data) {
    return (
      <Page>
        <ErrorBox>{t('common.networkError')}</ErrorBox>
      </Page>
    );
  }
  const v = view.data;
  const business = v.business;
  const billBlocked =
    !billChecks.data?.fields ||
    billChecks.data.checks.some(
      (c) =>
        (c.code === 'B1' || c.code === 'B2') &&
        c.result === 'flag' &&
        /overlap|not your/.test(c.line),
    );
  const canNext =
    step === 1
      ? business.level !== 'none'
      : step === 2
        ? !state.documentId || !billBlocked
        : step === 3
          ? state.dieselLitres != null
          : step === 4
            ? (state.productionTonnes ?? 0) > 0
            : true;
  const c1 = tonnesChecks.data?.checks.find((c) => c.code === 'C1');

  return (
    <Page
      action={
        <div className="flex gap-2">
          {step > 1 && (
            <Button variant="secondary" className="w-auto" onClick={() => go(step - 1)}>
              {t('data.back')}
            </Button>
          )}
          {step < 5 ? (
            <Button disabled={!canNext} onClick={() => go(step + 1)} data-testid="wizard-next">
              {t('data.next')}
            </Button>
          ) : (
            <Button
              disabled={finish.isPending}
              onClick={() => finish.mutate()}
              data-testid="wizard-finish"
            >
              {t('data.finish')}
            </Button>
          )}
        </div>
      }
    >
      {(location.state as { signedInNote?: boolean } | null)?.signedInNote && (
        <p className="rounded-card bg-copper-50 p-2 text-small text-copper-800">
          {t('login.signedInNote')}
        </p>
      )}
      <h1 className="font-heading text-title font-semibold">{t('data.title')}</h1>
      <p className="text-small font-semibold text-green-700">{t('data.topLine')}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2 text-small">
          <span className="font-semibold">
            {t('data.stepOf', { n: step })}: {t(`data.steps.${step}`)}
          </span>
          <Link
            to="/home"
            className="inline-flex min-h-12 items-center text-green-700 underline underline-offset-4"
          >
            {t('data.skip')}
          </Link>
        </div>
        <div
          className="flex gap-1"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={5}
          aria-valuenow={step}
          aria-label={t('data.stepOf', { n: step })}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              key={n}
              className={`h-2 flex-1 rounded-full ${n <= step ? 'bg-green-700' : 'bg-line'}`}
            />
          ))}
        </div>
      </div>

      {step === 1 && (
        <BusinessStep
          siteId={siteId}
          view={v}
          onChange={(b) =>
            qc.setQueryData<OnboardingView>(['onboarding', siteId], { ...v, business: b })
          }
        />
      )}
      {step === 2 && <BillsStep siteId={siteId} state={state} setState={save} />}
      {step === 3 && (
        <NumberStep
          intro={t('data.fuels.intro')}
          label={t('data.fuels.diesel')}
          value={state.dieselLitres}
          sample={Boolean(state.sample?.fuel)}
          onValue={(n) => save({ dieselLitres: n, sample: { fuel: false } })}
          onSample={() => save({ dieselLitres: v.samples.dieselLitres, sample: { fuel: true } })}
        >
          <Card className="space-y-2">
            <h2 className="font-heading text-card-title font-semibold">
              {t('data.fuels.comingTitle')}
            </h2>
            <ul className="space-y-1 text-small">
              {(['invoice', 'coke', 'furnaceOil', 'lpg'] as const).map((k) => (
                <li key={k} className="flex flex-wrap items-center gap-2">
                  <StatusPill tone="neutral">{t('data.fuels.comingTag')}</StatusPill>
                  {t(`data.fuels.${k}`)}
                </li>
              ))}
            </ul>
          </Card>
        </NumberStep>
      )}
      {step === 4 && (
        <NumberStep
          intro={t('data.production.intro')}
          label={t('data.production.tonnes')}
          value={state.productionTonnes}
          sample={Boolean(state.sample?.production)}
          onValue={(n) => save({ productionTonnes: n, sample: { production: false } })}
          onSample={() =>
            save({ productionTonnes: v.samples.productionTonnes, sample: { production: true } })
          }
        >
          {c1 && (
            <Card className="space-y-2" data-testid="c1-check">
              <h2 className="font-heading text-card-title font-semibold">
                {t('data.production.c1Title')}
              </h2>
              <CheckList checks={[c1]} labelKey="data.bills.codes" />
            </Card>
          )}
        </NumberStep>
      )}
      {step === 5 && (
        <ReviewStep
          siteId={siteId}
          state={state}
          setState={(s) => save({ ...s, documentId: s.documentId ?? null })}
        />
      )}
      <p className="text-small text-ink-muted">{t('data.saved')}</p>
    </Page>
  );
}
