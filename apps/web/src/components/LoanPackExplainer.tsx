import { useTranslation } from 'react-i18next';
import type { Icon } from '@phosphor-icons/react';
import { Bank } from '@phosphor-icons/react/dist/csr/Bank';
import { ChartLine } from '@phosphor-icons/react/dist/csr/ChartLine';
import { Coins } from '@phosphor-icons/react/dist/csr/Coins';
import { Factory } from '@phosphor-icons/react/dist/csr/Factory';
import { Files } from '@phosphor-icons/react/dist/csr/Files';
import { Leaf } from '@phosphor-icons/react/dist/csr/Leaf';
import { ListChecks } from '@phosphor-icons/react/dist/csr/ListChecks';
import { Receipt } from '@phosphor-icons/react/dist/csr/Receipt';
import { Scales } from '@phosphor-icons/react/dist/csr/Scales';
import { Card } from './kit/Card';
import { Qr } from './site/Qr';

const INSIDE: Array<[string, Icon]> = [
  ['bills', Receipt],
  ['saving', ChartLine],
  ['cost', Coins],
  ['emi', Scales],
  ['co2', Leaf],
  ['footprint', Factory],
  ['schemes', Bank],
  ['method', Files],
];

/** Why the loan-ready summary exists, what is in it, who reads it and how they check it (D6b). */
export function LoanPackExplainer({ reportId }: { reportId: string }) {
  const { t } = useTranslation();
  const verifyUrl = `${window.location.origin}/verify/${reportId}`;
  return (
    <div className="space-y-3" data-testid="pack-explainer">
      <Card className="space-y-2 border-l-4 border-green-700">
        <h2 className="font-heading text-card-title font-semibold">{t('report.why.title')}</h2>
        <ul className="list-disc space-y-1 pl-5">
          {(['l1', 'l2', 'l3'] as const).map((k) => (
            <li key={k}>{t(`report.why.${k}`)}</li>
          ))}
        </ul>
      </Card>
      <Card className="space-y-2">
        <h2 className="flex items-center gap-2 font-heading text-card-title font-semibold">
          <ListChecks size={22} className="text-green-700" aria-hidden="true" />
          {t('report.inside.title')}
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {INSIDE.map(([k, I]) => (
            <li key={k} className="flex gap-2">
              <I size={20} className="mt-0.5 shrink-0 text-green-700" aria-hidden="true" />
              <span>{t(`report.inside.${k}`)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="space-y-3">
          <div className="space-y-1">
            <h2 className="font-heading text-card-title font-semibold">{t('report.who.title')}</h2>
            <p>{t('report.who.body')}</p>
          </div>
          <div className="space-y-1">
            <h2 className="font-heading text-card-title font-semibold">
              {t('report.check.title')}
            </h2>
            <p>{t('report.check.body')}</p>
          </div>
        </div>
        <Qr url={verifyUrl} alt={t('report.check.qrAlt')} />
      </Card>
    </div>
  );
}
