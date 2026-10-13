import { useTranslation } from 'react-i18next';
import type { Icon } from '@phosphor-icons/react';
import { ChartLine } from '@phosphor-icons/react/dist/csr/ChartLine';
import { Factory } from '@phosphor-icons/react/dist/csr/Factory';
import { Leaf } from '@phosphor-icons/react/dist/csr/Leaf';
import { QrCode } from '@phosphor-icons/react/dist/csr/QrCode';
import { Receipt } from '@phosphor-icons/react/dist/csr/Receipt';
import { Scales } from '@phosphor-icons/react/dist/csr/Scales';
import { DEMO_REPORT_ID } from '../../components/site/content';
import { SampleLoanExample } from '../../components/site/LoanExample';
import { Band, PageHero, PublicLayout, SectionTitle } from '../../components/site/PublicLayout';
import { Qr } from '../../components/site/Qr';

const GETS: Array<[string, Icon]> = [
  ['bills', Receipt],
  ['range', ChartLine],
  ['emi', Scales],
  ['co2', Leaf],
  ['footprint', Factory],
  ['qr', QrCode],
];

export default function ForLenders() {
  const { t } = useTranslation();
  const verifyUrl = `${window.location.origin}/verify/${DEMO_REPORT_ID}`;
  return (
    <PublicLayout>
      <PageHero
        title={t('site.lenders.title')}
        lead={t('site.lenders.lead')}
        aside={
          <p
            className="rounded-card bg-green-50 p-5 font-heading text-card-title font-semibold text-green-900"
            data-testid="lenders-big"
          >
            {t('site.lenders.big')}
          </p>
        }
      />
      <Band defer={false}>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <SectionTitle>{t('site.lenders.gets.title')}</SectionTitle>
            <ul className="space-y-3">
              {GETS.map(([k, I]) => (
                <li key={k} className="flex gap-3">
                  <I size={24} className="mt-0.5 shrink-0 text-green-700" aria-hidden="true" />
                  <span>{t(`site.lenders.gets.${k}`)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            <SectionTitle>{t('site.lenders.why.title')}</SectionTitle>
            <p>{t('site.lenders.why.body')}</p>
            <div className="flex flex-wrap items-center gap-4 rounded-card border bg-surface p-4">
              <Qr url={verifyUrl} alt={t('site.lenders.qr.alt')} />
              <div className="min-w-[12rem] flex-1 space-y-1">
                <h3 className="font-heading text-card-title font-semibold">
                  {t('site.lenders.qr.title')}
                </h3>
                <p className="text-small text-ink-muted">{t('site.lenders.qr.body')}</p>
              </div>
            </div>
          </div>
        </div>
      </Band>
      <Band tone="surface">
        <SectionTitle>{t('site.lenders.example')}</SectionTitle>
        <SampleLoanExample />
      </Band>
      <Band>
        <SectionTitle>{t('site.lenders.schemes.title')}</SectionTitle>
        <p className="text-ink-muted">{t('site.lenders.schemes.note')}</p>
        <ul className="grid gap-4 md:grid-cols-3">
          {(['sidbi', 'gift', 'zed'] as const).map((k) => (
            <li key={k} className="space-y-2 rounded-card border bg-surface p-4 shadow-card">
              <h3 className="font-heading text-card-title font-semibold">
                {t(`site.lenders.schemes.${k}.name`)}
              </h3>
              <p className="text-small">{t(`site.lenders.schemes.${k}.body`)}</p>
            </li>
          ))}
        </ul>
      </Band>
    </PublicLayout>
  );
}
