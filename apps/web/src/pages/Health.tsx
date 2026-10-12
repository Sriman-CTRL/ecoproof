import type { TFunction } from 'i18next';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorBox, monthLabel, Page, PRIMARY, Rupees, SourceNumber } from '../components/ui';
import { api, type Finding, type Insights } from '../lib/api';
import { formatDecimal } from '../lib/format';
import { getSession } from '../lib/session';

export function useInsights(month: string | null, shiftableKwh?: number | null) {
  const siteId = getSession()?.siteId ?? '';
  const qs = new URLSearchParams();
  if (month) qs.set('month', month.slice(0, 7));
  if (shiftableKwh != null) qs.set('shiftableKwh', String(shiftableKwh));
  return useQuery({
    queryKey: ['insights', siteId, month, shiftableKwh ?? null],
    queryFn: () => api<Insights>(`/sites/${siteId}/insights?${qs}`),
    placeholderData: keepPreviousData,
  });
}

export function ruleLine(f: Finding, t: TFunction): string {
  return t('health.rule', {
    line: f.rule.line,
    validFrom: f.rule.validFrom ?? t('health.unknown'),
  });
}

export default function Health() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const month = params.get('month');
  const [shiftable, setShiftable] = useState('');
  const shiftNum = shiftable.trim() === '' ? null : Number(shiftable.replace(/,/g, ''));
  const q = useInsights(month, shiftNum != null && Number.isFinite(shiftNum) ? shiftNum : null);
  const d = q.data;
  const lang = i18n.resolvedLanguage ?? 'en';

  return (
    <Page
      action={
        <button
          type="button"
          className={PRIMARY}
          onClick={() => navigate(`/actions${month ? `?month=${month}` : ''}`)}
        >
          {t('health.seePlan')}
        </button>
      }
    >
      {q.isLoading && <p>{t('common.loading')}</p>}
      {q.isError && <ErrorBox>{t('health.loadFailed')}</ErrorBox>}
      {d && (
        <>
          <h1 className="text-xl font-bold">
            {t('health.title', { month: monthLabel(d.month, lang) })}
          </h1>
          {d.findings.length === 0 && (
            <p className="rounded-xl bg-white p-5 shadow-sm">{t('health.noFindings')}</p>
          )}
          {d.findings.map((f) => (
            <FindingCard key={f.code} f={f} shiftable={shiftable} onShiftable={setShiftable} />
          ))}
          {d.passed.length > 0 && (
            <section>
              <h2 className="mb-1 text-sm font-semibold text-gray-500">{t('health.passed')}</h2>
              <ul className="space-y-1 text-gray-500">
                {d.passed.map((f) => (
                  <li key={f.code}>✓ {t(`health.passedLabel.${f.code}`)}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </Page>
  );
}

function FindingCard({
  f,
  shiftable,
  onShiftable,
}: {
  f: Finding;
  shiftable: string;
  onShiftable: (v: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <section
      className="space-y-3 rounded-2xl bg-white p-5 shadow-sm"
      data-testid={`finding-${f.code}`}
    >
      <h2 className="text-sm font-medium text-gray-600">{t(`health.name.${f.code}`)}</h2>
      {f.inrPerMonth != null ? (
        <p className="text-3xl font-bold">
          <SourceNumber source={ruleLine(f, t)}>
            <Rupees value={f.inrPerMonth} />
          </SourceNumber>{' '}
          <span className="text-base font-normal text-gray-600">{t('health.perMonth')}</span>
        </p>
      ) : (
        <p className="text-lg font-semibold">{t('health.enterUnits')}</p>
      )}
      <p>{t(`health.fix.${f.code}`)}</p>
      {f.code === 'peak_use' && (
        <label className="block text-sm">
          <span className="font-medium">{t('health.shiftable')}</span>
          <input
            inputMode="numeric"
            className="mt-1 min-h-12 w-full rounded-lg border px-3 text-base"
            value={shiftable}
            onChange={(e) => onShiftable(e.target.value.replace(/[^\d.,]/g, ''))}
          />
        </label>
      )}
      <button
        type="button"
        className="flex min-h-12 w-full items-center justify-between text-left font-semibold"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>ⓘ {t('health.why')}</span>
        <span aria-hidden>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t pt-3 text-sm">
          <ul className="space-y-1">
            {Object.entries(f.explain).map(([k, v]) => (
              <li key={k} className="flex justify-between gap-3">
                <span className="text-gray-600">{t(`health.key.${k}`, { defaultValue: k })}</span>
                <span className="font-medium">
                  {typeof v === 'number' ? formatDecimal(v) : (v ?? '-')}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-600">{ruleLine(f, t)}</p>
          <p className="text-xs text-gray-600">
            {t('health.ruleSource', { source: f.rule.source })}
          </p>
          {f.assumption && <p className="text-xs text-gray-600">{f.assumption}</p>}
        </div>
      )}
    </section>
  );
}
