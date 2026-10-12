import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import i18n from '../i18n';
import { nextText, pathText, type Progress } from './progress';

const t = i18n.getFixedT('en') as TFunction;
const step = (key: string, params: Record<string, string | number> = {}): Progress['next'] => ({
  key,
  params,
  text: 'API fallback',
  href: '/x',
});

describe('next step wording', () => {
  const start = step('startAction', {
    code: 'reduce_contracted_demand',
    title: 'Reduce contracted demand',
  });

  it('button says "Start: <action>", path line says "Next: <action>" with one prefix', () => {
    const button = nextText(start, t);
    const line = t('kit.path.next', { step: pathText(start, t) });
    expect(button).toMatch(/^Start: /);
    expect(line).toMatch(/^Next: (?!Start:)/);
    expect(line.split(':')).toHaveLength(2);
  });

  it('no other next key doubles a prefix on the path line', () => {
    const keys = ['addBill', 'moreBills', 'keepAdding', 'makeLoanPack', 'shareBuyer'];
    for (const k of keys) {
      const line = t('kit.path.next', { step: pathText(step(k, { count: 3 }), t) });
      expect(line).not.toMatch(/^Next: (Next|Start|Add): /);
      expect(line.startsWith('Next: ')).toBe(true);
    }
  });
});
