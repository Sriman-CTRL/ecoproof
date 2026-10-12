import imageCompression from 'browser-image-compression';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Camera } from '@phosphor-icons/react/dist/csr/Camera';
import { ChatCircle } from '@phosphor-icons/react/dist/csr/ChatCircle';
import { FileArrowUp } from '@phosphor-icons/react/dist/csr/FileArrowUp';
import { BUTTON_CLASS, Button } from '../components/kit/Button';
import { Card } from '../components/kit/Card';
import { DemoReaderBanner } from '../components/DemoReaderBanner';
import { ErrorBox, Page } from '../components/ui';
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
  const [preview, setPreview] = useState<string | null>(null);

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
    if (file.type.startsWith('image/')) setPreview(URL.createObjectURL(file));
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
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void onFile(f);
    e.target.value = '';
  };
  return (
    <Page
      action={
        busy ? null : (
          <label className={`${BUTTON_CLASS.primary} cursor-pointer`}>
            <Camera size={24} aria-hidden="true" />
            {t('bills.takePhoto')}
            <input
              type="file"
              className="sr-only"
              accept="image/*,application/pdf"
              data-testid="bill-file"
              onChange={pick}
            />
          </label>
        )
      }
    >
      <h1 className="font-heading text-title font-semibold">{t('bills.newTitle')}</h1>
      <DemoReaderBanner />
      {busy ? (
        <Card className="space-y-3 text-center" role="status">
          {preview && (
            <div className="relative mx-auto max-h-80 w-fit overflow-hidden rounded-card border">
              <img
                src={preview}
                alt={t('bills.scanAlt')}
                className="max-h-80 w-auto object-contain"
              />
              <span
                aria-hidden="true"
                className="absolute inset-x-0 h-1 animate-scan bg-copper-500 shadow-card"
              />
            </div>
          )}
          <p className="font-heading text-card-title font-semibold">
            {phase === 'compressing' ? t('bills.compressing') : t('bills.reading')}
          </p>
          <p className="text-small text-ink-muted">{t('bills.readingHint')}</p>
        </Card>
      ) : (
        <>
          <p className="text-ink-muted">{t('bills.photoHelp')}</p>
          <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-green-700 bg-green-50 p-6 text-center text-green-900">
            <Camera size={56} weight="duotone" className="text-green-700" aria-hidden="true" />
            <span className="font-heading text-card-title font-semibold">
              {t('bills.takePhoto')}
            </span>
            <input
              type="file"
              className="sr-only"
              accept="image/*,application/pdf"
              onChange={pick}
            />
          </label>
          <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-button border border-green-700 px-4 py-2 font-semibold text-green-700">
            <FileArrowUp size={24} aria-hidden="true" />
            {t('bills.chooseFile')}
            <input
              type="file"
              className="sr-only"
              accept="image/*,application/pdf"
              onChange={pick}
            />
          </label>
          <p className="flex items-center gap-2 text-small text-ink-muted">
            <ChatCircle size={20} aria-hidden="true" />
            {t('bills.whatsapp')}
          </p>
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
      <span className="text-small font-semibold">{t(`fields.${k}.label`)}</span>
      <input
        className="mt-1 min-h-12 w-full rounded-button border bg-surface px-3 text-body"
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
        <Button disabled={busy} onClick={() => void submit()}>
          {t('bills.manualSubmit')}
        </Button>
      }
    >
      <h1 className="font-heading text-card-title font-semibold">{t('bills.cantRead')}</h1>
      <ErrorBox>{t('bills.blurry')}</ErrorBox>
      <p className="text-ink-muted">{t('bills.cantReadHelp')}</p>
      {err && <ErrorBox>{err}</ErrorBox>}
      {input('periodStart', 'date')}
      {input('periodEnd', 'date')}
      {input('kwh', 'text')}
      {input('kvah', 'text')}
      <details className="rounded-card border bg-surface p-3">
        <summary className="min-h-12 cursor-pointer font-semibold">
          {t('bills.manualOptional')}
        </summary>
        <div className="mt-2 space-y-3">{MANUAL_OPTIONAL.map((k) => input(k, 'text'))}</div>
      </details>
    </Page>
  );
}
