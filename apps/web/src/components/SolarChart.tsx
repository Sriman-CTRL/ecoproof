import { useTranslation } from 'react-i18next';
import { formatNumber } from '../lib/format';
import type { SolarMonth } from '../lib/solar';
import { niceMax, useWidth } from './DualAxisChart';
import { monthLabel } from './ui';

const PAD = { l: 44, r: 8, t: 12, b: 28 };

/**
 * Import (green) and export (copper) kWh side by side, one slot per month after solar. Same
 * hand-drawn SVG style as SavingsChart; the numbers also sit in a visually hidden table.
 */
export function SolarChart({ months, lang }: { months: SolarMonth[]; lang: string }) {
  const { t } = useTranslation();
  // Drawn at the container's width so labels stay 12px from phone to desktop.
  const [ref, W] = useWidth<HTMLDivElement>(320);
  if (months.length === 0) return null;
  const H = W >= 640 ? 260 : 200;
  const max = niceMax(Math.max(1, ...months.flatMap((m) => [m.importKwh, m.exportKwh])));
  const slot = (W - PAD.l - PAD.r) / months.length;
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);
  const x = (i: number) => PAD.l + slot * (i + 0.5);
  const barW = Math.min(28, slot * 0.32);
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const short = (m: SolarMonth) => monthLabel(m.month, lang).split(' ')[0];
  const bars = [
    {
      key: 'import',
      dx: -barW / 2 - 1,
      fill: 'var(--color-green-600)',
      v: (m: SolarMonth) => m.importKwh,
    },
    {
      key: 'export',
      dx: barW / 2 + 1,
      fill: 'var(--color-copper-700)',
      v: (m: SolarMonth) => m.exportKwh,
    },
  ];

  return (
    <figure className="space-y-2">
      <div ref={ref} className="w-full">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="block max-w-full"
          role="img"
          aria-label={t('household.after.chartLabel')}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line
                x1={PAD.l}
                x2={W - PAD.r}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--color-line)"
                strokeWidth={1}
              />
              <text
                x={PAD.l - 4}
                y={y(v) + 4}
                textAnchor="end"
                fontSize={12}
                fill="var(--color-ink-muted)"
              >
                {formatNumber(v)}
              </text>
            </g>
          ))}
          {months.map((m, i) => (
            <g key={m.month}>
              {bars.map((b) => (
                <rect
                  key={b.key}
                  x={x(i) + b.dx - barW / 2}
                  y={y(b.v(m))}
                  width={barW}
                  height={y(0) - y(b.v(m))}
                  rx={2}
                  fill={b.fill}
                />
              ))}
              <text
                x={x(i)}
                y={H - 8}
                textAnchor="middle"
                fontSize={12}
                fill="var(--color-ink-muted)"
              >
                {short(m)}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <figcaption className="space-y-1 text-small">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="size-3 rounded-[2px] bg-green-600" />
          {t('household.after.legendImport')}
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="size-3 rounded-[2px] bg-copper-700" />
          {t('household.after.legendExport')}
        </span>
        <span className="block text-ink-muted">{t('household.after.axisNote')}</span>
      </figcaption>
      <div className="sr-only">
        <table>
          <caption>{t('household.after.chartLabel')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('household.after.col.month')}</th>
              <th scope="col">{t('household.after.legendImport')}</th>
              <th scope="col">{t('household.after.legendExport')}</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month}>
                <th scope="row">{monthLabel(m.month, lang)}</th>
                <td>{formatNumber(m.importKwh)}</td>
                <td>{formatNumber(m.exportKwh)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
