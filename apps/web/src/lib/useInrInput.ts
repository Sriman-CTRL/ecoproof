import { useState } from 'react';
import { displayDigits, parseDigits } from './format';

/**
 * A rupee amount input: plain digits while typing (no regrouping under the caret, which turned
 * "10,00,000" into "10,00,00" mid-edit), Indian grouping when not focused.
 */
export function useInrInput(initial: number | null = null) {
  const [raw, setRaw] = useState(initial && initial > 0 ? String(Math.round(initial)) : '');
  const [focused, setFocused] = useState(false);
  return {
    value: parseDigits(raw),
    inputProps: {
      inputMode: 'numeric' as const,
      value: focused ? raw : displayDigits(raw),
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
      onChange: (e: { target: { value: string } }) => setRaw(e.target.value.replace(/\D/g, '')),
    },
  };
}
