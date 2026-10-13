import { useTranslation } from 'react-i18next';
import { ErrorNote } from '../kit/ErrorNote';
import { Skeleton } from '../kit/Skeleton';

/** While the free-tier API wakes up (or if it cannot be reached) on a public page. */
export function SampleSkeleton({ error = false }: { error?: boolean }) {
  const { t } = useTranslation();
  if (error) return <ErrorNote what={t('common.genericError')} />;
  return (
    <div aria-busy="true" className="space-y-3">
      <p className="text-small text-ink-muted">{t('site.loading')}</p>
      <Skeleton />
    </div>
  );
}
