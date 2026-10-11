import imageCompression from 'browser-image-compression';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorBox, Page, PRIMARY } from '../components/ui';
import { ApiError, api, postJson, type DocumentView, type UploadResponse } from '../lib/api';
import { describeError } from '../lib/errors';
import { getSession } from '../lib/session';

const POLL_MS = 1500;
const POLL_LIMIT_MS = 60_000;

type Phase = 'idle' | 'compressing' | 'reading' | 'manual';

const MANUAL_REQUIRED = ['periodStart', 'periodEnd', 'kwh', 'kvah'] as const;
// Optional fields default to 0 / a placeholder so the owner only types the 3 key values.
const MANUAL_OPTIONAL = [
  'pf',
  'mdKva',
  'contractedDemandKva',
  'peakKwh',
  'energyCharges',
  'demandCharges',
  'total',
] as const;

export default function NewBill() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const siteId = getSession()?.siteId ?? '';
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  async function poll(documentId: string) {
    setPhase('reading');
    const started = Date.now();
    while (!cancelled.current && Date.now() - started < POLL_LIMIT_MS) {
      try {
        const d = await api<DocumentView>(`/documents/${documentId}`);
        if (cancelled.current) return;
        if (d.status === 'extracted' || d.status === 'confirmed') {
          navigate(`/bills/${documentId}/confirm`, { replace: true });
          return;
        }
        if (d.status === 'needs_manual') break;
      } catch (e) {
        setError(describeError(e, t));
        setPhase('idle');
        return;
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
    if (!cancelled.current) setPhase('manual');
  }

  // Resume an in-progress upload (Home passes ?doc=<id>).
  const resumeId = params.get('doc');
  useEffect(() => {
    if (resumeId) void poll(resumeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId]);

  async function onFile(file: File) {
    setError(null);
    try {
      let body: File | Blob = file;
      if (file.type.startsWith('image/')) {
        setPhase('compressing');
        body = await imageCompression(file, {
          maxSizeMB: 0.29,
          maxWidthOrHeight: 2000,
          useWebWorker: true,
          fileType: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        }).catch(() => file);
      }
      const form = new FormData();
      form.append('file', body, file.name);
      const r = await api<UploadResponse & { status: string }>(`/sites/${siteId}/documents`, {
        method: 'POST',
        body: form,
      });
      if (r.status === 'already_received') {
        navigate(`/bills/${r.documentId}/confirm`, { replace: true });
        return;
      }
      await poll(r.documentId);
    } catch (e) {
      setError(
        e instanceof ApiError && e.code !== 'NETWORK'
          ? describeError(e, t)
          : t('bills.uploadFailed'),
      );
      setPhase('idle');
    }
  }

  if (phase === 'manual') {
    return (
      <ManualForm
        siteId={siteId}
        onDone={(id) => navigate(`/bills/${id}/confirm`, { replace: true })}
      />
    );
  }

  const busy = phase === 'compressing' || phase === 'reading';
  return (
    <Page
      action={
        busy ? null : (
          <label className={`${PRIMARY} cursor-pointer`}>
            📷 {t('bills.choose')}
            <input
              type="file"
              className="sr-only"
              accept="image/*,application/pdf"
              capture="environment"
              data-testid="bill-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = '';
              }}
            />
          </label>
        )
      }
    >
      <h1 className="text-2xl font-bold">{t('bills.newTitle')}</h1>
      {busy ? (
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm" role="status">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-emerald-700 border-t-transparent" />
          <p className="text-lg font-semibold">
            {phase === 'compressing' ? t('bills.compressing') : t('bills.reading')}
          </p>
          <p className="mt-1 text-sm text-gray-600">{t('bills.readingHint')}</p>
        </div>
      ) : (
        <>
          <p className="text-gray-700">{t('bills.newHelp')}</p>
          <p className="text-sm text-gray-500">💬 {t('bills.whatsapp')}</p>
        </>
      )}
      {error && <ErrorBox>{error}</ErrorBox>}
    </Page>
  );
}

function ManualForm({ siteId, onDone }: { siteId: string; onDone: (id: string) => void }) {
  const { t } = useTranslation();
  const [v, setV] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));

  async function submit() {
    if (MANUAL_REQUIRED.some((k) => !v[k]?.trim())) {
      setErr(t('common.required'));
      return;
    }
    setBusy(true);
    setErr(null);
    const num = (k: string) => (v[k]?.trim() ? v[k] : '0');
    // Power factor is kWh / kVAh by definition, so it can be worked out when left blank.
    const toN = (x?: string) => Number((x ?? '').replace(/[,\s]/g, ''));
    const derivedPf =
      toN(v.kvah) > 0 && toN(v.kwh) > 0
        ? String(Math.round((toN(v.kwh) / toN(v.kvah)) * 100) / 100)
        : '0';
    try {
      const r = await postJson<UploadResponse>(`/sites/${siteId}/documents/manual`, {
        fields: {
          consumerNo: 'MANUAL',
          billNo: `MANUAL-${v.periodStart}`,
          periodStart: v.periodStart,
          periodEnd: v.periodEnd,
          kwh: v.kwh,
          kvah: v.kvah,
          pf: v.pf?.trim() ? v.pf : derivedPf,
          mdKva: num('mdKva'),
          contractedDemandKva: num('contractedDemandKva'),
          peakKwh: num('peakKwh'),
          energyCharges: num('energyCharges'),
          demandCharges: num('demandCharges'),
          otherCharges: {},
          total: num('total'),
        },
      });
      onDone(r.documentId);
    } catch (e) {
      setErr(describeError(e, t));
      setBusy(false);
    }
  }

  const input = (k: string, type: string) => (
    <label key={k} className="block">
      <span className="text-sm font-medium">{t(`fields.${k}.label`)}</span>
      <input
        className="mt-1 min-h-12 w-full rounded-lg border px-3 text-base"
        type={type}
        inputMode={type === 'text' ? 'decimal' : undefined}
        value={v[k] ?? ''}
        onChange={(e) => set(k, e.target.value)}
      />
    </label>
  );

  return (
    <Page
      action={
        <button type="button" className={PRIMARY} disabled={busy} onClick={() => void submit()}>
          {t('bills.manualSubmit')}
        </button>
      }
    >
      <h1 className="text-xl font-bold">{t('bills.cantRead')}</h1>
      <p className="text-gray-700">{t('bills.cantReadHelp')}</p>
      {err && <ErrorBox>{err}</ErrorBox>}
      {input('periodStart', 'date')}
      {input('periodEnd', 'date')}
      {input('kwh', 'text')}
      {input('kvah', 'text')}
      <details className="rounded-xl bg-white p-3">
        <summary className="min-h-10 cursor-pointer font-medium">
          {t('bills.manualOptional')}
        </summary>
        <div className="mt-2 space-y-3">{MANUAL_OPTIONAL.map((k) => input(k, 'text'))}</div>
      </details>
    </Page>
  );
}
