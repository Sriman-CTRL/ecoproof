import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatInr, inrScale } from '../../lib/format';
import { prefersReducedMotion } from './motion';

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
 * Rupees first, units second, CO2 third (Doc 06 principle 1). The figure counts up once per
 * session when `countUpKey` is set; screen readers always get the final value.
 */
export function RupeeHero({
  value,
  unitsText,
  co2Text,
  countUpKey,
  label,
}: {
  value: number;
  unitsText?: string;
  co2Text?: string;
  countUpKey?: string;
  label?: string;
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
      <p className="num font-heading text-hero font-semibold" aria-label={formatInr(value)}>
        <span aria-hidden="true">{formatInr(shown)}</span>
      </p>
      {scale && (
        <p className="text-body">
          {t('kit.rupee.words', { amount: scale.amount, unit: t(`kit.rupee.${scale.unit}`) })}
        </p>
      )}
      {unitsText && <p className="num text-body">{unitsText}</p>}
      {co2Text && <p className="num text-small text-ink-muted">{co2Text}</p>}
    </div>
  );
}
