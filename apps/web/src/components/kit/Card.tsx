import type { HTMLAttributes } from 'react';

export const CARD_CLASS = 'rounded-card border bg-surface p-4 shadow-card';

export function Card({ className = '', ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={`${CARD_CLASS} ${className}`} {...rest} />;
}
