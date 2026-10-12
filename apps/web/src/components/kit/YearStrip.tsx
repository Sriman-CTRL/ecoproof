import { useTranslation } from 'react-i18next';

/** Bills needed before the savings baseline unlocks (plan 2.5: "unlocks the baseline at 9"). */
const BASELINE_MONTHS = 9;

export interface YearMonth {
  label: string;
  confirmed: boolean;
}

/** 12 tiles like the consumption-history graph printed on Indian bills; filled = confirmed bill. */
export function YearStrip({ months }: { months: YearMonth[] }) {
  const { t } = useTranslation();
  const n = months.filter((m) => m.confirmed).length;
  const more = BASELINE_MONTHS - n;
  return (
    <div className="space-y-2">
      <ol className="grid grid-cols-12 items-end gap-1">
        {months.map((m, i) => (
          <li key={i} className="flex flex-col items-center gap-1">
            <span
              aria-hidden="true"
              className={`block h-8 w-full origin-bottom rounded-sm border ${
                m.confirmed ? 'animate-tile-fill border-green-700 bg-green-700' : 'bg-surface'
              }`}
            />
            <span className="sr-only">
              {m.label}: {t(m.confirmed ? 'kit.year.confirmed' : 'kit.year.missing')}
            </span>
            <span aria-hidden="true" className="text-[0.875rem] leading-none text-ink-muted">
              {m.label.slice(0, 1)}
            </span>
          </li>
        ))}
      </ol>
      <p className="num text-body font-semibold">{t('kit.year.count', { n })}</p>
      <p className="text-small text-ink-muted">
        {more > 0 ? t('kit.year.toUnlock', { count: more }) : t('kit.year.ready')}
      </p>
    </div>
  );
}
