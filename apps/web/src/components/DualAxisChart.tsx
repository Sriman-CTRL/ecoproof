import { useEffect, useRef, useState } from 'react';

/** A round upper limit for an axis: 1, 2 or 5 times a power of ten. */
export function niceMax(v: number): number {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}

/** Width of the element in CSS px, so the SVG draws at 1:1 and text stays 12px at any width. */
function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => {
      if (e) setW(Math.max(240, Math.round(e.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export interface DualRow {
  key: string;
  /** Axis label, e.g. "Oct". */
  short: string;
  /** Table label, e.g. "Oct 2026". */
  label: string;
  bar: number;
  line: number | null;
}

/**
 * Bars on the left axis, a line on the right axis, one slot per month. Both axes carry a title
 * with units; the latest bar carries its value. The same numbers sit in a visually hidden table.
 */
export function DualAxisChart({
  rows,
  ariaLabel,
  barTitle,
  lineTitle,
  barTick,
  lineTick,
  barValue,
  lineValue,
  barColor = 'var(--color-green-600)',
  lineColor = 'var(--color-copper-700)',
  monthHeader,
}: {
  rows: DualRow[];
  ariaLabel: string;
  /** Left axis title with unit, e.g. "t CO2 a month". */
  barTitle: string;
  /** Right axis title with unit; leave out when no row has a line value. */
  lineTitle?: string;
  barTick: (v: number) => string;
  lineTick?: (v: number) => string;
  barValue: (v: number) => string;
  lineValue?: (v: number) => string;
  barColor?: string;
  lineColor?: string;
  monthHeader: string;
}) {
  const [ref, W] = useWidth<HTMLDivElement>(320);
  if (rows.length === 0) return null;
  const hasLine = !!lineTitle && rows.some((r) => r.line != null);
  const H = W >= 640 ? 260 : 220;
  const PAD = { l: 52, r: hasLine ? 52 : 12, t: 28, b: 28 };
  const barMax = niceMax(Math.max(...rows.map((r) => r.bar)));
  const lineVals = rows.flatMap((r) => (r.line == null ? [] : [r.line]));
  const lineMax = hasLine ? niceMax(Math.max(...lineVals)) : 1;
  const slot = (W - PAD.l - PAD.r) / rows.length;
  const yb = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / barMax);
  const yl = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / lineMax);
  const x = (i: number) => PAD.l + slot * (i + 0.5);
  const barW = Math.min(36, slot * 0.6);
  const ticks = [0, 0.5, 1];
  const linePath = rows
    .map((r, i) => (r.line == null ? null : `${x(i)},${yl(r.line)}`))
    .filter(Boolean)
    .map((p, i) => `${i ? 'L' : 'M'}${p}`)
    .join(' ');
  const last = rows.length - 1;
  // Every second label when slots get narrow (12 months at 360px).
  const every = slot < 30 ? 2 : 1;

  return (
    <figure className="space-y-2">
      <div ref={ref} className="w-full">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="block max-w-full"
          role="img"
          aria-label={ariaLabel}
        >
          <text x={4} y={12} fontSize={12} fontWeight={600} fill="var(--color-ink-muted)">
            {barTitle}
          </text>
          {hasLine && (
            <text
              x={W - 4}
              y={12}
              textAnchor="end"
              fontSize={12}
              fontWeight={600}
              fill="var(--color-ink-muted)"
            >
              {lineTitle}
            </text>
          )}
          {ticks.map((f) => (
            <g key={f}>
              <line
                x1={PAD.l}
                x2={W - PAD.r}
                y1={yb(f * barMax)}
                y2={yb(f * barMax)}
                stroke="var(--color-line)"
              />
              <text
                x={PAD.l - 6}
                y={yb(f * barMax) + 4}
                textAnchor="end"
                fontSize={12}
                fill="var(--color-ink-muted)"
              >
                {barTick(f * barMax)}
              </text>
              {hasLine && lineTick && (
                <text
                  x={W - PAD.r + 6}
                  y={yl(f * lineMax) + 4}
                  fontSize={12}
                  fill="var(--color-ink-muted)"
                >
                  {lineTick(f * lineMax)}
                </text>
              )}
            </g>
          ))}
          {rows.map((r, i) => (
            <g key={r.key}>
              <rect
                x={x(i) - barW / 2}
                y={yb(r.bar)}
                width={barW}
                height={Math.max(0, yb(0) - yb(r.bar))}
                rx={2}
                fill={barColor}
                opacity={i === last ? 1 : 0.75}
              />
              {(i % every === last % every || i === last) && (
                <text
                  x={x(i)}
                  y={H - 8}
                  textAnchor="middle"
                  fontSize={12}
                  fill="var(--color-ink-muted)"
                >
                  {r.short}
                </text>
              )}
            </g>
          ))}
          <text
            x={x(last)}
            y={yb(rows[last]!.bar) - 6}
            textAnchor={slot < 60 ? 'end' : 'middle'}
            fontSize={12}
            fontWeight={700}
            fill="var(--color-ink)"
          >
            {barValue(rows[last]!.bar)}
          </text>
          {hasLine && (
            <>
              <path d={linePath} fill="none" stroke={lineColor} strokeWidth={2.5} />
              {rows.map((r, i) =>
                r.line == null ? null : (
                  <circle
                    key={r.key}
                    cx={x(i)}
                    cy={yl(r.line)}
                    r={3.5}
                    fill="var(--color-surface)"
                    stroke={lineColor}
                    strokeWidth={2}
                  />
                ),
              )}
            </>
          )}
        </svg>
      </div>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-small">
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-3 rounded-[2px]"
            style={{ background: barColor }}
          />
          {barTitle}
        </span>
        {hasLine && (
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="h-0.5 w-5" style={{ background: lineColor }} />
            {lineTitle}
          </span>
        )}
      </figcaption>
      <div className="sr-only">
        <table>
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th scope="col">{monthHeader}</th>
              <th scope="col">{barTitle}</th>
              {hasLine && <th scope="col">{lineTitle}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row">{r.label}</th>
                <td>{barValue(r.bar)}</td>
                {hasLine && <td>{r.line == null ? '-' : (lineValue ?? String)(r.line)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
