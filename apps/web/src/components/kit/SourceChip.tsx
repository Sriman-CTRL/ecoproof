import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from './BottomSheet';

export type SourceQuality = 'fromBill' | 'youEntered';

/**
 * A number with a dotted underline; tapping it shows where it came from (Doc 06 principle 4).
 * The sheet shows the whole bill image: extraction has no field coordinates, so no crop yet.
 */
export function SourceChip({
  children,
  lineName,
  month,
  quality,
  imageUrl,
  className = '',
}: {
  children: ReactNode;
  lineName: string;
  month?: string;
  quality?: SourceQuality;
  imageUrl?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button
        type="button"
        className={`num relative text-left underline decoration-dotted decoration-2 underline-offset-4 before:absolute before:-inset-x-1 before:-inset-y-3.5 before:content-[''] ${className}`}
        aria-haspopup="dialog"
        // Inline in text: the ::before overlay makes the tap target 48px tall.
        data-hit-area="48"
        title={t('common.tapSource')}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      <BottomSheet open={open} title={t('kit.source.title')} onClose={close}>
        <div className="space-y-2">
          <p className="text-body font-semibold">{lineName}</p>
          {month && <p className="text-small text-ink-muted">{t('kit.source.month', { month })}</p>}
          {quality && (
            <span
              className={`inline-block rounded-chip px-3 py-1 text-small font-semibold ${
                quality === 'fromBill'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-copper-50 text-copper-800'
              }`}
            >
              {t(`common.${quality}`)}
            </span>
          )}
          {imageUrl && (
            <figure className="space-y-1">
              <img
                src={imageUrl}
                alt={t('kit.source.billImage')}
                className="max-h-64 w-full rounded-card border object-contain"
              />
              <figcaption className="text-small text-ink-muted">
                {t('kit.source.billImage')}
              </figcaption>
            </figure>
          )}
        </div>
      </BottomSheet>
    </>
  );
}
