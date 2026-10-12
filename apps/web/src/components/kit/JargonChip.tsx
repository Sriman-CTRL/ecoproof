import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type JargonTerm =
  'kvah' | 'powerFactor' | 'maximumDemand' | 'contractedDemand' | 'peakHours';

/** The term with a small "?" chip; tapping it shows one plain line (Doc 06 jargon rule). */
export function JargonChip({ term }: { term: JargonTerm }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const id = useId();
  const word = t(`kit.jargon.${term}.term`);
  return (
    <span className="inline">
      <span>{word}</span>{' '}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        // 24px chip, 48px tap target via the ::before overlay.
        data-hit-area="48"
        aria-label={t('kit.jargon.open', { term: word })}
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex size-6 items-center justify-center rounded-chip border border-green-600 align-middle text-small leading-none font-semibold text-green-700 before:absolute before:-inset-3 before:content-['']"
      >
        ?
      </button>
      {open && (
        <span id={id} className="mt-1 block rounded-card bg-green-50 p-3 text-small text-ink">
          {t(`kit.jargon.${term}.line`)}
        </span>
      )}
    </span>
  );
}
