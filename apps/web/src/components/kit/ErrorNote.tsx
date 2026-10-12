import type { ReactNode } from 'react';
import { WarningCircle } from '@phosphor-icons/react/dist/csr/WarningCircle';

/** What happened, then what to do about it. Red is for errors and losses only. */
export function ErrorNote({
  what,
  todo,
  children,
}: {
  what: ReactNode;
  todo?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex gap-2 rounded-card border border-loss bg-loss-50 p-3 text-small text-loss"
    >
      <WarningCircle size={20} className="mt-px shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-1">
        <div className="font-semibold">{what}</div>
        {todo && <div className="text-ink">{todo}</div>}
        {children}
      </div>
    </div>
  );
}
