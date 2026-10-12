import { useTranslation } from 'react-i18next';
import { formatNumber } from '../lib/format';
import type { SavingsMonth } from '../lib/savings';
import { DualAxisChart } from './DualAxisChart';
import { monthLabel } from './ui';

/**
 * Adjusted baseline (line) against actual kWh (bars), one slot per month after the action, on
 * one kWh axis. Drawn at the container's width; the numbers also sit in a hidden table.
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
  const k = (v: number) => (v === 0 ? '0' : `${formatNumber(Math.round(v / 1000))}k`);
  return (
    <DualAxisChart
      sharedAxis
      ariaLabel={t('savings.chartLabel')}
      monthHeader={t('savings.col.month')}
      barTitle={t('savings.axisTitle')}
      lineTitle={t('savings.axisTitle')}
      barLegend={t('savings.legendActual')}
      lineLegend={t('savings.legendBaseline')}
      rows={months.map((m) => ({
        key: m.month,
        short: monthLabel(`${m.month}-01`, lang).split(' ')[0]!,
        label: monthLabel(`${m.month}-01`, lang),
        bar: m.actualKwh,
        line: m.adjustedBaselineKwh,
      }))}
      barTick={k}
      lineTick={k}
      barValue={(v) => `${formatNumber(v)} kWh`}
      lineValue={(v) => `${formatNumber(v)} kWh`}
      caption={
        <>
          {summary && (
            <span className="num block font-semibold" data-testid="savings-chart-summary">
              {t('savings.twinTitle')}: {summary}
            </span>
          )}
          <span className="block text-ink-muted">{t('savings.axisNote')}</span>
        </>
      }
    />
  );
}
