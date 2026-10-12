import { cleanup, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../../i18n';
import { findBanned } from '../../locales/wording';
import { CarbonHero } from './CarbonHero';
import { EmiVsSavingBar } from './EmiVsSavingBar';
import { RupeeHero } from './RupeeHero';
import { StampBadge, type StampVariant } from './StampBadge';

afterEach(cleanup);

describe('RupeeHero', () => {
  it('shows Indian grouping and lakh words', () => {
    render(<RupeeHero value={100000} />);
    expect(screen.getByText('₹1,00,000')).toBeTruthy();
    expect(screen.getByText('about ₹1 lakh')).toBeTruthy();
  });
});

describe('CarbonHero', () => {
  it('shows tonnes with one decimal and the trend in words', () => {
    render(<CarbonHero tonnes={66.795} unit="t CO2" label="Carbon this month" trend={-3.4} />);
    expect(screen.getByTestId('carbon-hero').textContent).toContain('66.8 t CO2');
    expect(screen.getByText('3.4 t less than last month')).toBeTruthy();
  });

  it('hides the arrow for a change under 0.05 t', () => {
    render(<CarbonHero tonnes={1} unit="t CO2" label="x" trend={0.01} />);
    expect(screen.queryByText(/than last month/)).toBeNull();
  });
});

describe('EmiVsSavingBar', () => {
  it('says "short" when the EMI is more than the saving', () => {
    render(<EmiVsSavingBar emi={70000} saving={60000} />);
    expect(screen.getByText('₹10,000 short every month')).toBeTruthy();
    expect(screen.queryByText(/left in your pocket/)).toBeNull();
  });

  it('says what is left when the saving covers the EMI', () => {
    render(<EmiVsSavingBar emi={20276} saving={60000} />);
    expect(screen.getByText('₹39,724 left in your pocket every month')).toBeTruthy();
  });
});

describe('StampBadge', () => {
  const variants: StampVariant[] = ['verified', 'early', 'estimate'];
  for (const lng of ['en', 'te']) {
    for (const v of variants) {
      it(`${lng}/${v}: never a bare "Verified"`, () => {
        const { container } = render(
          <I18nextProvider i18n={i18n.cloneInstance({ lng })}>
            <StampBadge variant={v} />
          </I18nextProvider>,
        );
        const text = container.textContent ?? '';
        expect(text.length).toBeGreaterThan(0);
        expect(findBanned(text)).toEqual([]);
        if (lng === 'en' && v === 'verified') expect(text).toBe('Verified by your bills');
      });
    }
  }
});
