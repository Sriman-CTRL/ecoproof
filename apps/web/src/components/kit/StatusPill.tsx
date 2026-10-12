import type { ReactNode } from 'react';

export type PillTone = 'positive' | 'check' | 'loss' | 'neutral';

/** Colour is never the only signal: the pill always carries a word. */
const TONE: Record<PillTone, string> = {
  positive: 'bg-green-50 text-green-700',
  check: 'bg-copper-50 text-copper-800',
  loss: 'bg-loss-50 text-loss',
  neutral: 'bg-paper text-ink-muted',
};

export function StatusPill({
  tone = 'neutral',
  children,
}: {
  tone?: PillTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-chip px-3 py-0.5 text-small font-semibold ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}
