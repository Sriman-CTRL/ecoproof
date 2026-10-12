import { useTranslation } from 'react-i18next';

/** A grey block shaped like the content that is coming. No spinners. */
export function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`block animate-pulse rounded-card bg-line ${className}`} />
  );
}

/** Placeholder for a card with a big figure and two lines of text. */
export function Skeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true" className="space-y-3 rounded-card border bg-surface p-4">
      <span className="sr-only">{t('common.loading')}</span>
      <SkeletonBlock className="h-4 w-1/3" />
      <SkeletonBlock className="h-10 w-2/3" />
      <SkeletonBlock className="h-4 w-full" />
      <SkeletonBlock className="h-4 w-5/6" />
    </div>
  );
}
