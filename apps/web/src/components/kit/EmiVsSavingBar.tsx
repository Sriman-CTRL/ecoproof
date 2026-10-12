import { useTranslation } from 'react-i18next';
import { formatInr } from '../../lib/format';

/** EMI and monthly saving on the same scale; the gap says what is left or short (FIN-3). */
export function EmiVsSavingBar({ emi, saving }: { emi: number; saving: number }) {
  const { t } = useTranslation();
  const max = Math.max(emi, saving, 1);
  const gap = saving - emi;
  const rows = [
    { key: 'emi', label: t('kit.emi.emi'), value: emi, bar: 'bg-ink-muted' },
    { key: 'saving', label: t('kit.emi.saving'), value: saving, bar: 'bg-green-700' },
  ];
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.key} className="space-y-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-small text-ink-muted">{r.label}</span>
            <span className="num font-heading text-card-title font-semibold">
              {formatInr(r.value)}
            </span>
          </div>
          <div className="h-3 w-full rounded-chip bg-paper">
            <div
              className={`h-3 rounded-chip ${r.bar}`}
              style={{ width: `${(Math.max(r.value, 0) / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
      <p
        className={`rounded-card p-3 text-body font-semibold ${
          gap >= 0 ? 'bg-green-50 text-green-700' : 'bg-loss-50 text-loss'
        }`}
      >
        {gap >= 0
          ? t('kit.emi.left', { amount: formatInr(gap) })
          : t('kit.emi.short', { amount: formatInr(-gap) })}
      </p>
    </div>
  );
}
