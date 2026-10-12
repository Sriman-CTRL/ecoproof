import { useTranslation } from 'react-i18next';

/** Below this share of measured data the ring turns copper and asks for a check (plan 2.5). */
const CHECK_BELOW = 70;
const R = 22;
const C = 2 * Math.PI * R;

/** Small ring with % of data measured (Doc 03 data quality score). */
export function DataQualityRing({ percent }: { percent: number }) {
  const { t } = useTranslation();
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const low = pct < CHECK_BELOW;
  return (
    <div
      className="inline-flex items-center gap-3"
      role="img"
      aria-label={t('kit.quality.aria', { pct })}
    >
      <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true" className="shrink-0">
        <circle cx="28" cy="28" r={R} fill="none" strokeWidth="6" className="stroke-green-100" />
        <circle
          cx="28"
          cy="28"
          r={R}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * C} ${C}`}
          transform="rotate(-90 28 28)"
          className={low ? 'stroke-copper-700' : 'stroke-green-700'}
        />
      </svg>
      <span className="flex flex-col">
        <span
          className={`num font-heading text-card-title font-semibold ${low ? 'text-copper-800' : 'text-ink'}`}
        >
          {pct}%
        </span>
        <span className="text-small text-ink-muted">{t('kit.quality.label')}</span>
        {low && (
          <span className="text-small font-semibold text-copper-800">{t('kit.quality.check')}</span>
        )}
      </span>
    </div>
  );
}
