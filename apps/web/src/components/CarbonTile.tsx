import { useTranslation } from 'react-i18next';
import { CarbonHero } from './kit/CarbonHero';
import { carbonTrend, type Carbon } from '../lib/carbon';
import { formatDecimal, formatFactor, formatRate } from '../lib/format';
import { monthLabel, tonnesText } from './ui';

/**
 * The carbon tile that sits beside the rupee tile: t CO2 this month split by source, intensity
 * per tonne and the trend; Demo B adds CO2 avoided so far, households the solar plan line.
 */
export function CarbonTile({ c }: { c: Carbon }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const l = c.latestMonth;
  const month = monthLabel(l.month, lang);
  const factor = l.factor;
  const sourceLine = factor
    ? t('carbon.factorLine', { version: factor.version ?? '-', value: formatFactor(factor.value) })
    : t('carbon.methodTitle');
  const grid = formatDecimal(Math.round(l.scope2T * 10) / 10);
  const diesel = formatDecimal(Math.round(l.scope1T * 10) / 10);
  const saved = c.savedSoFar;
  return (
    <CarbonHero
      tonnes={l.totalT}
      unit={t('carbon.unit')}
      label={t('carbon.heroLabel', { month })}
      source={{ lineName: [sourceLine, ...c.method.lines].join(' · '), month, quality: 'fromBill' }}
      splitText={
        l.scope1T > 0 ? t('carbon.split', { grid, diesel }) : t('carbon.splitGridOnly', { grid })
      }
      intensityText={
        l.intensity != null ? t('carbon.intensity', { value: formatRate(l.intensity) }) : undefined
      }
      trend={carbonTrend(c)}
      extra={
        <>
          {saved && (
            <p className="num font-semibold text-green-700" data-testid="carbon-avoided">
              {t('carbon.avoided', { value: tonnesText(saved.verifiedTco2 || saved.tco2) })}
            </p>
          )}
          {c.solar && (
            <p className="num font-semibold text-green-700" data-testid="carbon-solar">
              {t('carbon.solarAvoid', {
                kwp: formatDecimal(c.solar.kwp),
                value: formatDecimal(c.solar.tPerYear),
              })}
            </p>
          )}
        </>
      }
    />
  );
}
