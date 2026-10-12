import type { ReactNode } from 'react';

/**
 * Holds the screen's single primary button, pinned to the bottom with safe-area padding.
 * `--tabbar-h` lifts it above the bottom tab bar once that exists (D2).
 */
export function StickyPrimaryBar({ children }: { children: ReactNode }) {
  return (
    <div
      className="sticky z-10 border-t bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] [&_a]:min-h-[52px] [&_button]:min-h-[52px]"
      style={{ bottom: 'var(--tabbar-h, 0px)' }}
    >
      {children}
    </div>
  );
}
