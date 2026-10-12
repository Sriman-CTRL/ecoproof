import { useQuery } from '@tanstack/react-query';
import { Info } from '@phosphor-icons/react/dist/csr/Info';
import { useTranslation } from 'react-i18next';
import { publicApi } from '../lib/api';

/** The API's bill reader: "fake" on the public site, so uploads read the sample bill. */
export function useReaderMode() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => publicApi<{ reader?: 'gemini' | 'fake' }>('/health'),
    staleTime: Infinity,
    retry: false,
  }).data?.reader;
}

/** Copper "please check" note shown on the upload and confirm screens while the fake reader is on. */
export function DemoReaderBanner() {
  const { t } = useTranslation();
  if (useReaderMode() !== 'fake') return null;
  return (
    <p
      data-testid="demo-reader-banner"
      className="flex gap-2 rounded-card border border-copper-700 bg-copper-50 p-3 text-small text-copper-800"
    >
      <Info size={20} className="mt-px shrink-0" aria-hidden="true" />
      <span>{t('bills.demoReader')}</span>
    </p>
  );
}
