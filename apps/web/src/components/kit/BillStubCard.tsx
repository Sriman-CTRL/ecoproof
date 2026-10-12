import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatInr } from '../../lib/format';

/** Notches punched down the left edge, like a tear-off counterfoil (plan 2.5). */
const PERFORATION = {
  WebkitMask: 'radial-gradient(circle at 0 50%, transparent 5px, #000 5.5px) 0 0 / 100% 14px',
  mask: 'radial-gradient(circle at 0 50%, transparent 5px, #000 5.5px) 0 0 / 100% 14px',
};

/** A bill health finding: rupees a month on the stub, the one-line fix on the body. */
export function BillStubCard({
  monthly,
  title,
  fix,
  children,
}: {
  monthly: number;
  title: string;
  fix: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <article className="flex rounded-card border bg-surface" style={PERFORATION}>
      <div className="flex w-28 shrink-0 flex-col justify-center border-r-2 border-dashed bg-copper-50 py-4 pr-2 pl-4">
        <span className="num font-heading text-card-title font-semibold break-all text-copper-800">
          {formatInr(monthly)}
        </span>
        <span className="text-small text-copper-800">{t('kit.stub.perMonth')}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-1 p-4">
        <h3 className="text-card-title font-semibold">{title}</h3>
        <p className="text-small text-ink-muted">{fix}</p>
        {children}
      </div>
    </article>
  );
}
