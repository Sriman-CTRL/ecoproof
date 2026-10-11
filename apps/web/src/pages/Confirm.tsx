import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ErrorBox, Page, PRIMARY } from '../components/ui';
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
const EXPLAIN_KEYS: Record<string, string> = { kvah: 'kvah', pf: 'pf', mdKva: 'mdKva' };
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
    <Page showBusiness>
      {doc.isLoading && <p>{t('common.loading')}</p>}
      {doc.isError && (
        <>
          <ErrorBox>{t('confirm.loadFailed')}</ErrorBox>
          <Link to="/home" className={PRIMARY}>
            {t('results.backHome')}
          </Link>
        </>
      )}
      {doc.data && doc.data.status !== 'extracted' && (
        <>
          <ErrorBox>{t('confirm.notExtracted')}</ErrorBox>
          <Link to="/home" className={PRIMARY}>
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
  const [open, setOpen] = useState<string | null>(null);
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
    <div className="grid gap-4 md:grid-cols-2 md:items-start">
      <section className="md:sticky md:top-4">
        <h2 className="mb-2 font-semibold">{t('confirm.billPhoto')}</h2>
        {doc.fileUrl ? (
          <BillImage url={doc.fileUrl} alt={t('confirm.billPhoto')} />
        ) : (
          <p className="rounded-xl bg-white p-3 text-sm text-gray-600">{t('confirm.noPhoto')}</p>
        )}
      </section>

      <section className="space-y-3">
        <h1 className="text-2xl font-bold">{t('confirm.title')}</h1>
        <p className="text-sm text-gray-700">{t('confirm.help')}</p>

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
          <fieldset className="rounded-xl border border-amber-400 bg-amber-50 p-3">
            <legend className="px-1 text-sm font-semibold">{t('confirm.ackTitle')}</legend>
            {needsAck.map((m) => (
              <label key={m} className="flex min-h-12 items-start gap-3 py-2 text-sm">
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
          const explainKey = EXPLAIN_KEYS[k];
          return (
            <div key={k} data-testid={`field-${k}`} data-low={isLow ? 'true' : undefined}>
              <label
                htmlFor={`f-${k}`}
                className="flex items-baseline justify-between text-sm font-medium"
              >
                <span>{t(`fields.${k}.label`)}</span>
                {isLow && (
                  <span className="font-semibold text-amber-700">⚠ {t('confirm.pleaseCheck')}</span>
                )}
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id={`f-${k}`}
                  className={`min-h-12 w-full rounded-lg border-2 px-3 text-base ${
                    isLow ? 'border-amber-500 bg-amber-50' : 'border-gray-300 bg-white'
                  }`}
                  type={DATE_FIELDS.has(k) ? 'date' : 'text'}
                  inputMode={TEXT_FIELDS.has(k) || DATE_FIELDS.has(k) ? undefined : 'decimal'}
                  value={values[k] ?? ''}
                  onChange={(e) => setValues((p) => ({ ...p, [k]: e.target.value }))}
                />
                {unit && <span className="w-12 shrink-0 text-sm text-gray-600">{unit}</span>}
              </div>
              {explainKey && (
                <>
                  <button
                    type="button"
                    className="mt-1 min-h-10 text-sm text-emerald-800 underline"
                    aria-expanded={open === k}
                    onClick={() => setOpen(open === k ? null : k)}
                  >
                    ⓘ {t(`fields.${k}.label`)}?
                  </button>
                  {open === k && (
                    <p className="rounded-lg bg-white p-2 text-sm text-gray-700">
                      {t(`confirm.explain.${explainKey}`)}
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })}

        {Object.keys(other).length > 0 && (
          <div>
            <p className="text-sm font-medium">{t('fields.otherCharges.label')}</p>
            {Object.entries(other).map(([k, x]) => (
              <label key={k} className="mt-1 flex items-center gap-2 text-sm">
                <span className="w-1/2 break-words">{k.replace(/_/g, ' ')}</span>
                <input
                  className="min-h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 text-base"
                  inputMode="decimal"
                  value={x}
                  onChange={(e) => setOther((p) => ({ ...p, [k]: e.target.value }))}
                />
                <span className="w-8 text-sm text-gray-600">Rs</span>
              </label>
            ))}
          </div>
        )}

        <h2 className="pt-2 font-semibold">{t('confirm.yourNumbers')}</h2>
        <label className="block">
          <span className="text-sm font-medium">{t('confirm.tonnes')}</span>
          <input
            className="mt-1 min-h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 text-base"
            inputMode="decimal"
            value={tonnes}
            onChange={(e) => setTonnes(e.target.value)}
          />
          <span className="text-xs text-gray-600">{t('confirm.tonnesHelp')}</span>
        </label>
        <label className="block">
          <span className="text-sm font-medium">{t('confirm.diesel')}</span>
          <input
            className="mt-1 min-h-12 w-full rounded-lg border-2 border-gray-300 bg-white px-3 text-base"
            inputMode="decimal"
            value={diesel}
            onChange={(e) => setDiesel(e.target.value)}
          />
          <span className="text-xs text-gray-600">{t('confirm.dieselHelp')}</span>
        </label>

        {message && <ErrorBox>{message}</ErrorBox>}
        {!allTicked && <p className="text-sm text-amber-800">{t('confirm.mustTick')}</p>}
        <button
          type="button"
          className={PRIMARY}
          disabled={!allTicked || busy}
          onClick={() => void submit()}
        >
          {busy ? t('confirm.submitting') : t('confirm.submit')}
        </button>
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
        className="block rounded-xl bg-white p-3 underline"
      >
        📄 {alt}
      </a>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      className="max-h-[50vh] w-full rounded-xl border bg-white object-contain md:max-h-none"
      onError={() => setFailed(true)}
    />
  );
}
