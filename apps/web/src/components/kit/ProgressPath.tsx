import { useTranslation } from 'react-i18next';
import { Check } from '@phosphor-icons/react/dist/csr/Check';

export const PATH_STAGES = ['measured', 'baseline', 'saving', 'finance', 'buyer'] as const;
/** 1 = Measured ... 5 = Buyer-ready. */
export type PathStage = 1 | 2 | 3 | 4 | 5;

/**
 * Five stops on one line, drawn like a route on a cluster map (plan 6.1). Stops before
 * `currentStage` are reached; the current one is larger with "You are here".
 */
export function ProgressPath({
  currentStage,
  nextStep,
}: {
  /** 0 = nothing measured yet: every stop is still ahead. */
  currentStage: 0 | PathStage;
  nextStep: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <div className="relative -mx-3">
        <span aria-hidden="true" className="absolute top-4 right-[10%] left-[10%] h-0.5 bg-line" />
        <span
          aria-hidden="true"
          className="absolute top-4 left-[10%] h-0.5 bg-green-700"
          style={{ width: `${Math.max(0, currentStage - 1) * 20}%` }}
        />
        <ol className="relative grid grid-cols-5">
          {PATH_STAGES.map((stage, i) => {
            const reached = i + 1 < currentStage;
            const current = i + 1 === currentStage;
            return (
              <li
                key={stage}
                className="relative flex flex-col items-center gap-1 text-center"
                aria-current={current ? 'step' : undefined}
              >
                <span className="flex h-8 items-center">
                  <span
                    className={`flex items-center justify-center rounded-chip border-2 ${
                      current
                        ? 'size-8 border-green-700 bg-green-700 text-white'
                        : reached
                          ? 'size-6 border-green-700 bg-green-700 text-white'
                          : 'size-5 border-line bg-surface'
                    }`}
                  >
                    {reached && <Check size={14} weight="bold" aria-hidden="true" />}
                  </span>
                </span>
                <span
                  className={`max-w-full font-heading text-small hyphens-auto [overflow-wrap:break-word] ${current ? 'text-ink underline decoration-green-700 decoration-2 underline-offset-4' : 'text-ink-muted'}`}
                >
                  {t(`kit.path.stage.${stage}`)}
                  {reached && <span className="sr-only"> ({t('kit.path.reached')})</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      {currentStage > 0 && (
        <p className="inline-block rounded-button bg-green-50 px-2 py-0.5 text-small font-semibold text-green-700">
          {t('kit.path.here')}: {t(`kit.path.stage.${PATH_STAGES[currentStage - 1]}`)}
        </p>
      )}
      <p className="text-body font-semibold">{t('kit.path.next', { step: nextStep })}</p>
    </div>
  );
}
