import { useTranslation } from 'react-i18next';
import { formatNumber } from '../lib/format';
import type { SavingsMonth } from '../lib/savings';
import { monthLabel } from './ui';

const W = 320;
const H = 190;
const PAD = { l: 38, r: 8, t: 10, b: 26 };

/** A round upper limit for the axis: 1, 2 or 5 times a power of ten. */
function niceMax(v: number): number {
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}

/**
 * Adjusted baseline (line) against actual kWh (bars), one slot per month after the action.
 * Hand-drawn SVG in kit tokens; the same numbers sit in a visually hidden table for screen readers.
 */
export function SavingsChart({
  months,
  lang,
  summary,
}: {
  months: SavingsMonth[];
  lang: string;
  /** Rupees and t CO2 saved, as twin totals under the legend. */
  summary?: string;
}) {
  const { t } = useTranslation();
  if (months.length === 0) return null;
  const max = niceMax(Math.max(...months.flatMap((m) => [m.actualKwh, m.adjustedBaselineKwh])));
  const slot = (W - PAD.l - PAD.r) / months.length;
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);
  const x = (i: number) => PAD.l + slot * (i + 0.5);
  const barW = Math.min(28, slot * 0.55);
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const line = months
    .map((m, i) => `${i ? 'L' : 'M'}${x(i)},${y(m.adjustedBaselineKwh)}`)
    .join(' ');
  // Month names are short ("Oct 2026"): the month alone fits 360px, the year is in the table.
  const short = (m: SavingsMonth) => monthLabel(`${m.month}-01`, lang).split(' ')[0];

  return (
    <figure className="space-y-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={t('savings.chartLabel')}
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
              fontSize={11}
              fill="var(--color-ink-muted)"
            >
              {v === 0 ? '0' : `${formatNumber(v / 1000)}k`}
            </text>
          </g>
        ))}
        {months.map((m, i) => (
          <g key={m.month}>
            <rect
              x={x(i) - barW / 2}
              y={y(m.actualKwh)}
              width={barW}
              height={y(0) - y(m.actualKwh)}
              rx={2}
              fill="var(--color-green-600)"
            />
            <text
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              fontSize={11}
              fill="var(--color-ink-muted)"
            >
              {short(m)}
            </text>
          </g>
        ))}
        <path d={line} fill="none" stroke="var(--color-copper-700)" strokeWidth={2.5} />
        {months.map((m, i) => (
          <circle
            key={m.month}
            cx={x(i)}
            cy={y(m.adjustedBaselineKwh)}
            r={3.5}
            fill="var(--color-surface)"
            stroke="var(--color-copper-700)"
            strokeWidth={2}
          />
        ))}
      </svg>
      <figcaption className="space-y-1 text-small">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="h-0.5 w-5 bg-copper-700" />
          {t('savings.legendBaseline')}
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="size-3 rounded-[2px] bg-green-600" />
          {t('savings.legendActual')}
        </span>
        {summary && (
          <span className="num block font-semibold" data-testid="savings-chart-summary">
            {t('savings.twinTitle')}: {summary}
          </span>
        )}
        <span className="block text-ink-muted">{t('savings.axisNote')}</span>
      </figcaption>
      <div className="sr-only">
        <table>
          <caption>{t('savings.chartLabel')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('savings.col.month')}</th>
              <th scope="col">{t('savings.legendBaseline')}</th>
              <th scope="col">{t('savings.legendActual')}</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month}>
                <th scope="row">{monthLabel(`${m.month}-01`, lang)}</th>
                <td>{formatNumber(m.adjustedBaselineKwh)}</td>
                <td>{formatNumber(m.actualKwh)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
