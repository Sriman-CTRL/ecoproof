import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type LoanPackCreated } from './api';
import { getSession } from './session';

// Shape of GET /sites/:siteId/carbon (apps/api/src/services/carbon.ts).
export interface CarbonMonth {
  month: string;
  scope2T: number;
  scope1T: number;
  totalT: number;
  intensity: number | null;
}

export interface Carbon {
  household: boolean;
  latestMonth: CarbonMonth & {
    intensityTPerTonne: number | null;
    kwh: number | null;
    outputTonnes: number | null;
    factor: {
      id: string;
      value: number;
      unit: string;
      version: string | null;
      source: string;
      page: string | null;
    } | null;
  };
  /** Oldest first, up to 12. */
  months: CarbonMonth[];
  bySource: Array<{ source: 'grid_electricity' | 'diesel'; t: number; pct: number }>;
  reducible: Array<{
    actionCode: string;
    title: string;
    tPerYearLow: number;
    tPerYearHigh: number;
  }>;
  chargeOnly: Array<{ actionCode: string; title: string; annualInr: number | null }>;
  savedSoFar: { tco2: number; months: number; verifiedTco2: number } | null;
  solar: { kwp: number; tPerYear: number } | null;
  method: { lines: string[] };
  label: string;
  factorIds: string[];
  formulaVersion: string;
}

export function useCarbon() {
  const siteId = getSession()?.siteId ?? '';
  return useQuery({
    queryKey: ['carbon', siteId],
    queryFn: () => api<Carbon>(`/sites/${siteId}/carbon`),
  });
}

/** POST a carbon footprint statement (PDF, sealed, /verify QR). */
export function useMakeCarbonStatement() {
  const siteId = getSession()?.siteId ?? '';
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<LoanPackCreated>(`/sites/${siteId}/reports/carbon-statement`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['reports', siteId] }),
  });
}

/** Month-on-month change of the total, null with fewer than two months. */
export function carbonTrend(c: Carbon): number | null {
  const [prev, last] = c.months.slice(-2);
  return prev && last && c.months.length >= 2 ? last.totalT - prev.totalT : null;
}
