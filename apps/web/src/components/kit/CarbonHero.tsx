import type { ComponentProps, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownRight } from '@phosphor-icons/react/dist/csr/ArrowDownRight';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { formatDecimal } from '../../lib/format';
import { SourceChip } from './SourceChip';

/**
 * The carbon partner of RupeeHero, same size and weight (decision 12 Oct 2026: rupees and CO2
 * side by side). Tonnes with one decimal; `unit` says what the tonnes are (t CO2, t CO2e).
 */
export function CarbonHero({
  tonnes,
  unit,
  label,
  splitText,
  intensityText,
  trend,
  extra,
  source,
}: {
  tonnes: number;
  unit: string;
  label: string;
  /** e.g. "63.6 t electricity + 3.2 t diesel" */
  splitText?: ReactNode;
  /** e.g. "0.64 t CO2 per tonne of castings" */
  intensityText?: ReactNode;
  /** Change against last month in t; null hides the arrow. */
  trend?: number | null;
  extra?: ReactNode;
  source?: Omit<ComponentProps<typeof SourceChip>, 'children' | 'className'>;
}) {
  const { t } = useTranslation();
  const figure = (
    <span>
      {tonnes < 1 ? formatDecimal(tonnes) : formatDecimal(Math.round(tonnes * 10) / 10)}{' '}
      <span className="text-title font-semibold">{unit}</span>
    </span>
  );
  return (
    <div className="space-y-1" data-testid="carbon-hero">
      <p className="text-small text-ink-muted">{label}</p>
      <p className="num font-heading text-hero font-semibold text-green-900">
        {source ? <SourceChip {...source}>{figure}</SourceChip> : figure}
      </p>
      {splitText && <div className="num text-body">{splitText}</div>}
      {intensityText && <div className="num text-body">{intensityText}</div>}
      {trend != null && Math.abs(trend) >= 0.05 && (
        <p
          className={`num flex items-center gap-1 text-small font-semibold ${trend > 0 ? 'text-copper-800' : 'text-green-700'}`}
        >
          {trend > 0 ? (
            <ArrowUpRight size={16} weight="bold" aria-hidden="true" />
          ) : (
            <ArrowDownRight size={16} weight="bold" aria-hidden="true" />
          )}
          {t(trend > 0 ? 'carbon.trendUp' : 'carbon.trendDown', {
            value: formatDecimal(Math.abs(Math.round(trend * 10) / 10)),
          })}
        </p>
      )}
      {extra}
    </div>
  );
}
