import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import i18n from '../i18n';
import type { Finding } from '../lib/api';
import { explainLine } from './Health';

const t = i18n.getFixedT('en') as TFunction;
const rule = {
  id: 'r',
  discom: 'TGSPDCL',
  category: 'HT-I(A)',
  ruleType: 'kvah_billing',
  source: 's',
  validFrom: null,
  basisNote: null,
  line: 'l',
};

describe('explainLine (Health "What is ...?" lines)', () => {
  it("uses this bill's own power factor numbers", () => {
    const f: Finding = {
      code: 'power_factor',
      flagged: true,
      inrPerMonth: 60000,
      oneLineFix: '',
      explain: { kwh: 92000, kvah: 100000, lossKvah: 8000, energyRatePerKvah: 7.5 },
      rule,
    };
    expect(explainLine(f, t)).toBe(
      'Your bill shows 1,00,000 kVAh but only 92,000 kWh did useful work. ' +
        'The 8,000 kVAh difference is billed at ₹7.50 = ₹60,000 a month.',
    );
  });

  it('returns null rather than inventing a missing number', () => {
    const f: Finding = {
      code: 'power_factor',
      flagged: true,
      inrPerMonth: 60000,
      oneLineFix: '',
      explain: { kwh: 92000, kvah: null, lossKvah: 8000, energyRatePerKvah: 7.5 },
      rule,
    };
    expect(explainLine(f, t)).toBeNull();
  });
});
