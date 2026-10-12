import type { ReactNode } from 'react';
import type { Icon } from '@phosphor-icons/react';

/** Nothing here yet: a duotone icon (the only place duotone is used), what is missing, what to do. */
export function EmptyState({
  icon: IconCmp,
  title,
  body,
  action,
}: {
  icon: Icon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-dashed bg-surface p-6 text-center">
      <IconCmp size={48} weight="duotone" className="text-green-600" aria-hidden="true" />
      <h3 className="text-card-title font-semibold">{title}</h3>
      <p className="text-small text-ink-muted">{body}</p>
      {action}
    </div>
  );
}
