import type { HTMLAttributes } from 'react';

/** A sheet of paper: headline figures on a document (loan-ready summary, verify page). */
export function PaperSheet({ className = '', ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={`rounded-card border border-t-4 border-t-green-900 bg-surface p-4 shadow-card ${className}`}
      {...rest}
    />
  );
}
