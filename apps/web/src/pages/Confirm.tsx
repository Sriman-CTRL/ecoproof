import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { FileText } from '@phosphor-icons/react/dist/csr/FileText';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { BUTTON_CLASS, Button } from '../components/kit/Button';
import { JargonChip, type JargonTerm } from '../components/kit/JargonChip';
import { Skeleton } from '../components/kit/Skeleton';
import { StickyPrimaryBar } from '../components/kit/StickyPrimaryBar';
import { DemoReaderBanner } from '../components/DemoReaderBanner';
import { ErrorBox, Page } from '../components/ui';
import { ApiError, api, postJson, type DocumentView } from '../lib/api';
import { describeError } from '../lib/errors';

// Order and names follow PowerBillFields (packages/shared/src/powerBill.ts).
export const SCALAR_FIELDS = [
  'consumerNo',
  'billNo',
  'periodStart',
  'periodEnd',
  'kwh',
  'kvah',
  'pf',
  'mdKva',
  'contractedDemandKva',
  'peakKwh',
  'energyCharges',
  'demandCharges',
  'total',
] as const;
const JARGON: Record<string, JargonTerm> = {
  kvah: 'kvah',
  pf: 'powerFactor',
  mdKva: 'maximumDemand',
  contractedDemandKva: 'contractedDemand',
};
const TEXT_FIELDS = new Set(['consumerNo', 'billNo']);
const DATE_FIELDS = new Set(['periodStart', 'periodEnd']);

type Values = Record<string, string>;

export default function Confirm() {
  const { t } = useTranslation();
  const { documentId = '' } = useParams();
  const doc = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => api<DocumentView>(`/documents/${documentId}`),
  });

  return (
    <Page showBusiness wide>
      {doc.isLoading && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton />
          <Skeleton />
        </div>
      )}
      {doc.isError && (
        <>
          <ErrorBox>{t('confirm.loadFailed')}</ErrorBox>
          <Link to="/home" className={BUTTON_CLASS.primary}>
            {t('results.backHome')}
          </Link>
        </>
      )}
      {doc.data && doc.data.status !== 'extracted' && (
        <>
          <ErrorBox>{t('confirm.notExtracted')}</ErrorBox>
          <Link to="/home" className={BUTTON_CLASS.primary}>
            {t('results.backHome')}
          </Link>
        </>
      )}
      {doc.data && doc.data.status === 'extracted' && doc.data.fields && (
        <ConfirmForm documentId={documentId} doc={doc.data} />
      )}
    </Page>
  );
}

export function ConfirmForm({ documentId, doc }: { documentId: string; doc: DocumentView }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fields = doc.fields ?? {};
  const [values, setValues] = useState<Values>(() =>
    Object.fromEntries(SCALAR_FIELDS.map((k) => [k, String(fields[k] ?? '')])),
  );
  const [other, setOther] = useState<Values>(() =>
    Object.fromEntries(
      Object.entries((fields.otherCharges ?? {}) as Record<string, unknown>).map(([k, x]) => [
        k,
        String(x),
      ]),
    ),
  );
  const [tonnes, setTonnes] = useState('');
  const [diesel, setDiesel] = useState('');
  const [acked, setAcked] = useState<Set<string>>(new Set());
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsAck, setNeedsAck] = useState<string[]>(doc.validation.needsConfirmation);

  useEffect(() => setNeedsAck(doc.validation.needsConfirmation), [doc]);

  const low = new Set(doc.lowConfidence);
  const allTicked = needsAck.every((m) => acked.has(m));

  async function submit() {
    setMessage(null);
    setServerErrors([]);
    if (!tonnes.trim()) {
      setMessage(t('confirm.mustTonnes'));
      return;
    }
    setBusy(true);
    try {
      const r = await postJson<{ resultId: string }>(`/documents/${documentId}/confirm`, {
        fields: { ...values, otherCharges: other },
        productionTonnes: tonnes,
        ...(diesel.trim() ? { dieselLitres: diesel } : {}),
        acknowledged: [...acked],
      });
      // A new month changes "latest": drop cached months, insights and actions.
      await Promise.all(
        ['months', 'insights', 'actions', 'progress'].map((k) =>
          qc.invalidateQueries({ queryKey: [k] }),
        ),
      );
      navigate(`/results/${r.resultId}`, { replace: true });
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiError && (e.status === 422 || e.status === 409)) {
        const list = Array.isArray(e.details) ? (e.details as string[]).map(String) : [];
        if (e.status === 422) {
          setServerErrors(list);
          setMessage(t('confirm.validationFailed'));
        } else {
          setNeedsAck((prev) => [...new Set([...prev, ...list])]);
          setMessage(e.code === 'NEEDS_ACKNOWLEDGEMENT' ? t('confirm.needsAck') : e.message);
        }
      } else {
        setMessage(describeError(e, t));
      }
    }
  }

  const errors = [...doc.validation.errors, ...serverErrors];
  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <section className="lg:sticky lg:top-4">
        <h2 className="mb-2 font-heading text-card-title font-semibold">
          {t('confirm.billPhoto')}
        </h2>
        {doc.fileUrl ? (
          <BillImage url={doc.fileUrl} alt={t('confirm.billPhoto')} />
        ) : (
          <p className="rounded-card border bg-surface p-3 text-small text-ink-muted">
            {t('confirm.noPhoto')}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h1 className="font-heading text-title font-semibold">{t('confirm.title')}</h1>
        <DemoReaderBanner />
        <p className="text-small text-ink-muted">{t('confirm.help')}</p>

        {errors.length > 0 && (
          <ErrorBox>
            <p className="font-semibold">{t('confirm.errorsTitle')}</p>
            <ul className="mt-1 list-disc pl-5">
              {errors.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </ErrorBox>
        )}

        {needsAck.length > 0 && (
          <fieldset className="rounded-card border border-copper-700 bg-copper-50 p-3">
            <legend className="px-1 text-small font-semibold text-copper-800">
              {t('confirm.ackTitle')}
            </legend>
            {needsAck.map((m) => (
              <label key={m} className="flex min-h-12 items-start gap-3 py-2 text-small">
                <input
                  type="checkbox"
                  className="mt-0.5 h-6 w-6 shrink-0"
                  checked={acked.has(m)}
                  onChange={(e) =>
                    setAcked((prev) => {
                      const n = new Set(prev);
                      if (e.target.checked) n.add(m);
                      else n.delete(m);
                      return n;
                    })
                  }
                />
                <span>{m}</span>
              </label>
            ))}
          </fieldset>
        )}

        {SCALAR_FIELDS.map((k) => {
          const isLow = low.has(k);
          const unit = t(`fields.${k}.unit`);
          const jargon = JARGON[k];
          return (
            <div key={k} data-testid={`field-${k}`} data-low={isLow ? 'true' : undefined}>
              <label
                htmlFor={`f-${k}`}
                className="flex items-center justify-between gap-2 text-small font-semibold"
              >
                <span>{t(`fields.${k}.label`)}</span>
                {isLow ? (
                  <span className="inline-flex items-center gap-1 text-copper-800">
                    <Warning size={18} weight="fill" aria-hidden="true" />
                    {t('confirm.pleaseCheck')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-normal text-green-700">
                    <Check size={18} weight="bold" aria-hidden="true" />
                    <span className="sr-only">{t('confirm.readOk')}</span>
                  </span>
                )}
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id={`f-${k}`}
                  className={`min-h-12 w-full rounded-button border-2 px-3 text-body ${
                    isLow ? 'border-copper-700 bg-copper-50' : 'bg-surface'
                  }`}
                  type={DATE_FIELDS.has(k) ? 'date' : 'text'}
                  inputMode={TEXT_FIELDS.has(k) || DATE_FIELDS.has(k) ? undefined : 'decimal'}
                  value={values[k] ?? ''}
                  onChange={(e) => setValues((p) => ({ ...p, [k]: e.target.value }))}
                />
                {unit && <span className="w-12 shrink-0 text-small text-ink-muted">{unit}</span>}
              </div>
              {jargon && (
                <p className="mt-1 text-small text-ink-muted">
                  <JargonChip term={jargon} />
                </p>
              )}
            </div>
          );
        })}

        {Object.keys(other).length > 0 && (
          <div>
            <p className="text-small font-semibold">{t('fields.otherCharges.label')}</p>
            {Object.entries(other).map(([k, x]) => (
              <label key={k} className="mt-1 flex items-center gap-2 text-small">
                <span className="w-1/2 break-words">{k.replace(/_/g, ' ')}</span>
                <input
                  className="min-h-12 w-full rounded-button border-2 bg-surface px-3 text-body"
                  inputMode="decimal"
                  value={x}
                  onChange={(e) => setOther((p) => ({ ...p, [k]: e.target.value }))}
                />
                <span className="w-8 text-small text-ink-muted">Rs</span>
              </label>
            ))}
          </div>
        )}

        <h2 className="pt-2 font-heading text-card-title font-semibold">
          {t('confirm.yourNumbers')}
        </h2>
        <label className="block">
          <span className="text-small font-semibold">{t('confirm.tonnes')}</span>
          <input
            className="mt-1 min-h-12 w-full rounded-button border-2 bg-surface px-3 text-body"
            inputMode="decimal"
            value={tonnes}
            onChange={(e) => setTonnes(e.target.value)}
          />
          <span className="text-small text-ink-muted">{t('confirm.tonnesHelp')}</span>
        </label>
        <label className="block">
          <span className="text-small font-semibold">{t('confirm.diesel')}</span>
          <input
            className="mt-1 min-h-12 w-full rounded-button border-2 bg-surface px-3 text-body"
            inputMode="decimal"
            value={diesel}
            onChange={(e) => setDiesel(e.target.value)}
          />
          <span className="text-small text-ink-muted">{t('confirm.dieselHelp')}</span>
        </label>

        {message && <ErrorBox>{message}</ErrorBox>}
        {!allTicked && <p className="text-small text-copper-800">{t('confirm.mustTick')}</p>}
        <StickyPrimaryBar>
          <Button disabled={!allTicked || busy} onClick={() => void submit()}>
            {busy ? t('confirm.submitting') : t('confirm.submit')}
          </Button>
        </StickyPrimaryBar>
      </section>
    </div>
  );
}

function BillImage({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex min-h-12 items-center gap-2 rounded-card border bg-surface p-3 underline"
      >
        <FileText size={20} aria-hidden="true" />
        {alt}
      </a>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      className="max-h-[50vh] w-full rounded-card border bg-surface object-contain lg:max-h-none"
      onError={() => setFailed(true)}
    />
  );
}
