import { useTranslation } from 'react-i18next';

export type StampVariant = 'verified' | 'early' | 'estimate' | 'genuine' | 'mismatch';

const TONE: Record<StampVariant, string> = {
  verified: 'border-green-700 text-green-700',
  early: 'border-ink-muted text-ink-muted',
  estimate: 'border-copper-700 text-copper-800',
  genuine: 'border-green-700 text-green-700',
  mismatch: 'border-loss text-loss',
};

/**
 * Rubber-stamp label (Doc 05 wording). Text comes only from kit.stamp.*, so "Verified" can never
 * appear without "by your bills". `press` plays the stamp animation once (off for reduced motion).
 */
export function StampBadge({ variant, press = false }: { variant: StampVariant; press?: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-block max-w-full -rotate-3 rounded-[6px] border-[3px] border-double px-3 py-1 font-heading text-small font-bold tracking-wide uppercase ${TONE[variant]} ${press ? 'animate-stamp-press' : ''}`}
    >
      {t(`kit.stamp.${variant}`)}
    </span>
  );
}
