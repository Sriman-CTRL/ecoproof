import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatInr, inrScale } from '../../lib/format';
import { prefersReducedMotion } from './motion';
import { SourceChip } from './SourceChip';

const COUNT_UP_MS = 600;

function countUpDue(key: string | undefined): boolean {
  if (!key || prefersReducedMotion()) return false;
  try {
    const flag = `ecoproof.countup.${key}`;
    if (sessionStorage.getItem(flag)) return false;
    sessionStorage.setItem(flag, '1');
    return true;
  } catch {
    return false;
  }
}

/**
 * Rupees with their CO2 partner at equal weight (decision 12 Oct 2026); kWh is the supporting
 * line. The figure counts up once per session when `countUpKey` is set; screen readers always get
 * the final value.
 */
export function RupeeHero({
  value,
  unitsText,
  co2Text,
  countUpKey,
  label,
  source,
  size = 'full',
}: {
  value: number;
  unitsText?: ReactNode;
  co2Text?: ReactNode;
  countUpKey?: string;
  label?: string;
  /** Makes the figure a SourceChip: tapping it shows where the number comes from. */
  source?: Omit<ComponentProps<typeof SourceChip>, 'children' | 'className'>;
  /** "mini" is the envelope preview on /start: smaller figure, no words line. */
  size?: 'full' | 'mini';
}) {
  const { t } = useTranslation();
  const [shown, setShown] = useState(value);
  const scale = inrScale(value);

  useEffect(() => {
    if (!countUpDue(countUpKey)) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / COUNT_UP_MS);
      setShown(Math.round(value * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, countUpKey]);

  return (
    <div className="space-y-1">
      {label && <p className="text-small text-ink-muted">{label}</p>}
      <p
        className={`num font-heading font-semibold ${size === 'mini' ? 'text-title' : 'text-hero'}`}
        aria-label={formatInr(value)}
      >
        {source ? (
          <SourceChip {...source}>
            <span aria-hidden="true">{formatInr(shown)}</span>
          </SourceChip>
        ) : (
          <span aria-hidden="true">{formatInr(shown)}</span>
        )}
      </p>
      {scale && size === 'full' && (
        <p className="text-body">
          {t('kit.rupee.words', { amount: scale.amount, unit: t(`kit.rupee.${scale.unit}`) })}
        </p>
      )}
      {unitsText && <div className="num text-body">{unitsText}</div>}
      {co2Text && <div className="num text-body font-semibold text-green-700">{co2Text}</div>}
    </div>
  );
}
