import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { CARD_CLASS } from '../components/kit/Card';
import { Skeleton } from '../components/kit/Skeleton';
import { ErrorBox, Page } from '../components/ui';
import { useMitraSummary, type MitraPage } from '../lib/mitra';

const PAGES: MitraPage[] = ['govt', 'ngo'];

export default function MitraIndex() {
  const { t } = useTranslation();
  const q = useMitraSummary();
  return (
    <Page tab="mitra">
      <h1 className="font-heading text-title font-semibold">{t('mitra.indexTitle')}</h1>
      <p className="text-body font-semibold">{t('mitra.lead')}</p>
      {q.isLoading && <Skeleton />}
      {q.isError && <ErrorBox>{t('mitra.loadFailed')}</ErrorBox>}
      <div className="grid gap-3 lg:grid-cols-2 lg:gap-6">
        {PAGES.map((page) => (
          <Link
            key={page}
            to={`/mitra/${page}`}
            className={`${CARD_CLASS} flex min-h-12 items-center justify-between gap-2`}
          >
            <span className="space-y-1">
              <span className="block font-semibold">{t(`mitra.${page}.title`)}</span>
              {q.data && (
                <span className="num block text-small text-ink-muted">
                  {t('mitra.stepsDone', { done: q.data[page].done, total: q.data[page].total })}
                </span>
              )}
            </span>
            <ArrowRight size={20} className="shrink-0 text-green-700" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </Page>
  );
}
