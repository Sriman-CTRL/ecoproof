import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

/** Text wraps to two lines instead of truncating (Telugu runs longer). Min 48px tall. */
const BASE =
  'inline-flex min-h-12 items-center justify-center gap-2 text-center text-body font-semibold disabled:cursor-not-allowed';

export const BUTTON_CLASS: Record<ButtonVariant, string> = {
  primary: `${BASE} w-full rounded-button bg-green-700 px-4 py-2 text-white active:bg-green-900 disabled:bg-line disabled:text-ink-muted`,
  secondary: `${BASE} px-2 text-green-700 underline underline-offset-4 disabled:text-ink-muted`,
  danger: `${BASE} rounded-button border border-loss bg-surface px-4 py-2 text-loss active:bg-loss-50 disabled:opacity-60`,
};

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button type={type} className={`${BUTTON_CLASS[variant]} ${className}`} {...rest} />;
}
