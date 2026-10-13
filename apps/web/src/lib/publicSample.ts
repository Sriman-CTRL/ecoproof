import { useQuery } from '@tanstack/react-query';
import { api, type ActionItem } from './api';
import type { Carbon } from './carbon';
import type { SolarPlan, SolarResults } from './solar';

// Shape of GET /public/sample (apps/api/src/services/publicSample.ts): the SYNTHETIC Demo A
// foundry and Demo H home, read through the same services as the logged-in screens.
export interface PublicFactor {
  id: string;
  sourceType: string;
  value: number;
  unit: string;
  version: string | null;
  source: string;
  sourceUrl: string | null;
  page: string | null;
  quotedLine: string | null;
  status: string;
  gasBasis: string | null;
  basisNote: string | null;
  validFrom: string | null;
  validTo: string | null;
}

export interface PublicSample {
  sample: true;
  carbon: Carbon;
  factors: PublicFactor[];
  actions: ActionItem[];
  baselineRules: { minMonthsForRegression: number; maxCvRmsePct: number; maxAbsNmbePct: number };
  household: { plan: SolarPlan; results: SolarResults };
}

/** Public, no login. The free-tier API may take a while to wake: pages show a skeleton. */
export function usePublicSample() {
  return useQuery({
    queryKey: ['public-sample'],
    queryFn: () => api<PublicSample>('/public/sample'),
    staleTime: 5 * 60_000,
    retry: 3,
  });
}

/** The action the green-loan story is built on (D6b): the IGBT furnace row. */
export const LOAN_EXAMPLE_CODE = 'igbt_furnace';
