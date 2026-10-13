import { useTranslation } from 'react-i18next';
import { StampBadge } from '../../components/kit/StampBadge';
import { DEMO_CARBON_STATEMENT_ID } from '../../components/site/content';
import { Band, PageHero, PublicLayout, SectionTitle } from '../../components/site/PublicLayout';
import { Qr } from '../../components/site/Qr';

export default function ForBuyers() {
  const { t } = useTranslation();
  const verifyUrl = `${window.location.origin}/verify/${DEMO_CARBON_STATEMENT_ID}`;
  return (
    <PublicLayout>
      <PageHero title={t('site.buyers.title')} lead={t('site.buyers.lead')} />
      <Band defer={false}>
        <div className="grid gap-6 md:grid-cols-2">
          <section className="space-y-3 rounded-card border bg-surface p-4 shadow-card">
            <h2 className="font-heading text-title font-semibold">
              {t('site.buyers.statement.title')}
            </h2>
            <p>{t('site.buyers.statement.body')}</p>
            <div className="flex flex-wrap items-center gap-4">
              <Qr url={verifyUrl} alt={t('site.buyers.statement.alt')} />
              <p className="max-w-56 font-semibold">{t('site.buyers.statement.qr')}</p>
            </div>
          </section>
          <section
            className="space-y-3 rounded-card border bg-surface p-4 shadow-card"
            data-testid="buyers-cbam"
          >
            <h2 className="font-heading text-title font-semibold">{t('site.buyers.cbam.title')}</h2>
            <StampBadge variant="estimate" />
            <p>{t('site.buyers.cbam.body')}</p>
            <p className="font-semibold">{t('site.buyers.cbam.direct')}</p>
            <p className="text-small text-ink-muted">{t('site.buyers.cbam.verifier')}</p>
          </section>
        </div>
      </Band>
      <Band tone="surface">
        <SectionTitle>{t('site.buyers.scope.title')}</SectionTitle>
        <ul className="grid gap-4 md:grid-cols-2">
          <li className="rounded-card border-l-4 border-green-700 bg-paper p-4">
            {t('site.buyers.scope.now')}
          </li>
          <li className="rounded-card border-l-4 border-copper-700 bg-paper p-4">
            {t('site.buyers.scope.later')}
          </li>
        </ul>
        <p className="text-small text-ink-muted">{t('site.buyers.scope.note')}</p>
      </Band>
    </PublicLayout>
  );
}
