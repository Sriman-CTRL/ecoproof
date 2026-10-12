import { useTranslation } from 'react-i18next';
import { formatInr } from '../../lib/format';

/**
 * One bar: rupees a month found at full length, fixes started in green, the rest "still on the
 * table" (retention plan 3.2).
 */
export function HeadroomMeter({ found, started }: { found: number; started: number }) {
  const { t } = useTranslation();
  const got = Math.max(0, Math.min(started, found));
  const left = Math.max(0, found - got);
  const pct = found > 0 ? (got / found) * 100 : 0;
  return (
    <div className="space-y-2">
      <p className="num text-body font-semibold">
        {t('kit.headroom.found', { amount: formatInr(found) })}
      </p>
      <div className="flex h-4 w-full overflow-hidden rounded-chip border bg-copper-50">
        <div className="h-full bg-green-700" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-small">
        <span className="num text-green-700">
          {t('kit.headroom.started', { amount: formatInr(got) })}
        </span>
        <span className="num rounded-chip bg-copper-50 px-2 text-copper-800">
          {t('kit.headroom.table', { amount: formatInr(left) })}
        </span>
      </div>
    </div>
  );
}
