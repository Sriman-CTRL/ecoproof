import { useTranslation } from 'react-i18next';
import type { Carbon } from '../lib/carbon';
import { formatDecimal } from '../lib/format';

const COLOR: Record<Carbon['bySource'][number]['source'], string> = {
  grid_electricity: 'var(--color-green-600)',
  diesel: 'var(--color-copper-700)',
};

/** Where the carbon comes from: one horizontal stacked bar, then each part in words (no pie). */
export function SourceSplitBar({ parts }: { parts: Carbon['bySource'] }) {
  const { t } = useTranslation();
  const shown = parts.filter((p) => p.t > 0);
  if (shown.length === 0) return null;
  return (
    <div className="space-y-2" data-testid="source-split">
      <div aria-hidden="true" className="flex h-6 w-full overflow-hidden rounded-chip bg-paper">
        {shown.map((p) => (
          <span key={p.source} style={{ width: `${p.pct}%`, background: COLOR[p.source] }} />
        ))}
      </div>
      <ul className="space-y-1">
        {shown.map((p) => (
          <li key={p.source} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-[2px]"
              style={{ background: COLOR[p.source] }}
            />
            <span className="num">
              {t('carbon.sourceLine', {
                name: t(`carbon.source.${p.source}`),
                t: formatDecimal(Math.round(p.t * 10) / 10),
                unit: t(p.source === 'diesel' ? 'carbon.unitE' : 'carbon.unit'),
                pct: formatDecimal(p.pct),
              })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
