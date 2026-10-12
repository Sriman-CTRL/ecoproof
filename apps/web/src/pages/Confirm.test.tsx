import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import type { DocumentView } from '../lib/api';
import { ConfirmForm } from './Confirm';

vi.mock('../lib/api', async (orig) => ({
  ...(await orig<typeof import('../lib/api')>()),
  postJson: vi.fn().mockResolvedValue({ resultId: 'r1' }),
}));
import { postJson } from '../lib/api';

const doc: DocumentView = {
  status: 'extracted',
  fields: {
    consumerNo: 'SAMPLE-HT-0001',
    billNo: 'SAMPLE-2026-10',
    periodStart: '2026-10-01',
    periodEnd: '2026-10-31',
    kwh: 92000,
    kvah: 100000,
    pf: 0.92,
    mdKva: 300,
    contractedDemandKva: 500,
    peakKwh: 23000,
    energyCharges: 750000,
    demandCharges: 160000,
    otherCharges: { low_pf_surcharge: 0 },
    total: 910000,
  },
  confidence: { kvah: 0.4 },
  lowConfidence: ['kvah'],
  validation: { errors: [], needsConfirmation: ['Sanctioned load is not on file'] },
  fileUrl: null,
};

function renderForm() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ConfirmForm documentId="d1" doc={doc} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe('confirm screen', () => {
  it('highlights a low-confidence field and leaves the others plain', () => {
    renderForm();
    const kvah = screen.getByTestId('field-kvah');
    expect(kvah.dataset.low).toBe('true');
    expect(kvah.textContent).toContain('Please check');
    expect(kvah.querySelector('input')?.className).toContain('border-copper-700');
    expect(screen.getByTestId('field-kwh').dataset.low).toBeUndefined();
  });

  it('blocks submit until every needsConfirmation box is ticked', async () => {
    const user = userEvent.setup();
    renderForm();
    const submit = screen.getByRole('button', { name: 'Confirm all' });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('checkbox'));
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    await user.type(screen.getByLabelText(/Tonnes of good castings this month/), '100');
    await user.click(submit);
    expect(postJson).toHaveBeenCalledWith(
      '/documents/d1/confirm',
      expect.objectContaining({
        productionTonnes: '100',
        acknowledged: ['Sanctioned load is not on file'],
      }),
    );
  });
});
