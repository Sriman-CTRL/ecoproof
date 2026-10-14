import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { Lock } from '@phosphor-icons/react/dist/csr/Lock';
import { Question } from '@phosphor-icons/react/dist/csr/Question';
import { WarningCircle } from '@phosphor-icons/react/dist/csr/WarningCircle';
import { useTranslation } from 'react-i18next';
import type { BusinessView, CheckItem, StripMonth } from '../lib/dataIntake';

/** Copper "Sample" tag on values filled from sample data. */
export function SampleTag() {
  const { t } = useTranslation();
  return (
    <span className="rounded-chip bg-copper-50 px-2 text-small font-semibold text-copper-800">
      {t('data.sampleTag')}
    </span>
  );
}

const ICON = {
  pass: (
    <CheckCircle size={20} weight="fill" className="shrink-0 text-green-700" aria-hidden="true" />
  ),
  flag: (
    <WarningCircle
      size={20}
      weight="fill"
      className="shrink-0 text-copper-800"
      aria-hidden="true"
    />
  ),
  cant_check: <Question size={20} className="shrink-0 text-ink-muted" aria-hidden="true" />,
};

/** Pass / Needs a second look / Can't check, each with one plain line. */
export function CheckList({
  checks,
  labelKey,
}: {
  checks: CheckItem[];
  /** i18n prefix for the check names, e.g. "data.bills.codes". */
  labelKey: string;
}) {
  const { t } = useTranslation();
  return (
    <ul className="space-y-2" data-testid="check-list">
      {checks.map((c) => (
        <li key={c.code} className="flex gap-2" data-result={c.result}>
          {ICON[c.result]}
          <div className="min-w-0">
            <p className="text-small font-semibold">
              {t(`${labelKey}.${c.code}`, { defaultValue: c.code })}
              <span
                className={`ml-2 font-normal ${c.result === 'flag' ? 'text-copper-800' : 'text-ink-muted'}`}
              >
                {t(`data.results.${c.result}`)}
              </span>
            </p>
            <p className="text-small text-ink-muted [overflow-wrap:anywhere]">{c.line}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** 12 tiles; a gap is marked, never filled in. */
export function MonthStrip({ strip, highlight }: { strip: StripMonth[]; highlight?: string }) {
  const { t } = useTranslation();
  return (
    <ol className="grid grid-cols-6 gap-1 sm:grid-cols-12" data-testid="month-strip">
      {strip.map((m) => (
        <li key={m.month} className="flex flex-col items-center gap-1">
          <span
            aria-hidden="true"
            className={`block h-7 w-full rounded-sm border ${
              m.present
                ? m.month === highlight
                  ? 'border-copper-800 bg-copper-500'
                  : 'border-green-700 bg-green-700'
                : 'border-dashed border-copper-800 bg-surface'
            }`}
          />
          <span className="text-center text-[11px] leading-tight text-ink-muted">
            {m.label}
            {!m.present && <span className="block text-copper-800">{t('data.bills.gap')}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** 3-step ladder: 1 Self-declared, 2 Matched to documents, 3 government record (locked). */
export function BusinessLadder({ business }: { business: Pick<BusinessView, 'levelNumber'> }) {
  const { t } = useTranslation();
  const steps = [
    t('data.business.ladder1'),
    t('data.business.ladder2'),
    t('data.business.ladder3'),
  ];
  return (
    <ol className="space-y-2" data-testid="business-ladder">
      {steps.map((s, i) => {
        const n = i + 1;
        const reached = n <= business.levelNumber;
        const locked = n === 3;
        return (
          <li
            key={s}
            className={`flex items-start gap-3 rounded-card border p-3 ${
              reached ? 'border-green-700 bg-green-50' : 'bg-surface'
            }`}
          >
            <span
              className={`num flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-small font-semibold ${
                reached ? 'bg-green-700 text-white' : 'bg-paper text-ink-muted'
              }`}
            >
              {locked ? <Lock size={16} aria-hidden="true" /> : n}
            </span>
            <div>
              <p className="font-semibold">{s}</p>
              {locked && (
                <p className="text-small text-ink-muted">{t('data.business.level3Locked')}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
