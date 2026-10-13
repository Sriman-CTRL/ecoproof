import { useTranslation } from 'react-i18next';
import { SDG_ROWS } from '../../components/site/content';
import { Band, PageHero, PublicLayout, SectionTitle } from '../../components/site/PublicLayout';

export default function About() {
  const { t } = useTranslation();
  return (
    <PublicLayout>
      <PageHero title={t('site.about.title')} lead={t('site.about.lead')} />
      <Band defer={false}>
        <SectionTitle>{t('site.about.sdgTitle')}</SectionTitle>
        <div className="overflow-hidden rounded-card border bg-surface">
          <table className="w-full text-left" data-testid="about-sdg">
            <thead className="bg-paper text-small">
              <tr>
                <th scope="col" className="w-1/3 px-4 py-2 font-semibold">
                  {t('site.about.goal')}
                </th>
                <th scope="col" className="px-4 py-2 font-semibold">
                  {t('site.about.does')}
                </th>
              </tr>
            </thead>
            <tbody>
              {SDG_ROWS.map((r) => (
                <tr key={r} className="border-t align-top">
                  <th scope="row" className="px-4 py-3 font-heading font-semibold text-green-700">
                    {t(`site.sdg.${r}.name`)}
                  </th>
                  <td className="px-4 py-3">{t(`site.sdg.${r}.long`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Band>
      <Band tone="surface">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-3">
            <SectionTitle>{t('site.about.roadmap.title')}</SectionTitle>
            <ul className="list-disc space-y-2 pl-5">
              {(['whatsapp', 'cluster', 'live'] as const).map((k) => (
                <li key={k}>{t(`site.about.roadmap.${k}`)}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <p className="font-heading text-card-title font-semibold">{t('site.about.team')}</p>
            <p className="font-semibold">{t('landing.footer.sdg')}</p>
            <p className="text-ink-muted">{t('landing.footer.note')}</p>
          </div>
        </div>
      </Band>
    </PublicLayout>
  );
}
