import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { MonthRow } from '../lib/api';
import { formatDecimal, formatInr, formatNumber } from '../lib/format';
import { Card } from './kit/Card';
import { SourceChip } from './kit/SourceChip';
import { monthLabel } from './ui';

/** Month, rupees, units, tonnes CO2 as a ledger table. Rupees come first (Doc 06). */
export function MonthLedger({ rows }: { rows: MonthRow[] }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  return (
    <Card className="px-2">
      <table className="w-full text-small">
        <caption className="sr-only">{t('bills.tableLabel')}</caption>
        <thead>
          <tr className="border-b text-left text-ink-muted">
            <th scope="col" className="py-2 pr-2 font-semibold">
              {t('bills.month')}
            </th>
            <th scope="col" className="py-2 pr-2 text-right font-semibold">
              {t('bills.rupees')}
            </th>
            <th scope="col" className="py-2 pr-2 text-right font-semibold">
              {t('bills.units')}
            </th>
            <th scope="col" className="py-2 text-right font-semibold">
              {t('bills.co2')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const month = monthLabel(m.month, lang);
            const source = t('home.sourceBill', { month });
            const co2 = m.co2 ? (m.co2.scope2TCo2Grid ?? 0) + (m.co2.scope1TCo2eFuels ?? 0) : null;
            return (
              <tr key={m.month} className="border-b last:border-b-0">
                <th scope="row" className="py-1 pr-2 text-left font-medium">
                  {m.resultId ? (
                    <Link
                      to={`/results/${m.resultId}`}
                      className="inline-flex min-h-12 items-center text-green-700 underline underline-offset-4"
                    >
                      {month}
                    </Link>
                  ) : (
                    month
                  )}
                </th>
                <td className="num py-1 pr-2 text-right font-semibold">
                  {m.rupees.total != null ? (
                    <SourceChip lineName={source} month={month} quality="fromBill">
                      {formatInr(Math.round(m.rupees.total))}
                    </SourceChip>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="num py-1 pr-2 text-right">
                  {m.kwh != null ? (
                    <SourceChip lineName={source} month={month} quality="fromBill">
                      {formatNumber(m.kwh)}
                    </SourceChip>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="num py-1 text-right text-ink-muted">
                  {co2 != null ? formatDecimal(co2) : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
