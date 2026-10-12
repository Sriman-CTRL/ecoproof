import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { getSession } from './session';

// Shape of GET /sites/:siteId/savings (apps/api/src/services/savings.ts).
export type SavingsStatus = 'verified' | 'too_early';

export interface SavingsMonth {
  month: string;
  adjustedBaselineKwh: number;
  actualKwh: number;
  savedKwh: number;
  savedInr: number;
  savedTco2: number;
  cumulativeInr: number;
  status: SavingsStatus;
}

export interface Savings {
  baseline: {
    method: string;
    cvRmse: number | null;
    nmbe: number | null;
    passes: boolean;
    monthsUsed: number;
    a: number;
    b: number;
    formula: string;
  } | null;
  actions: Array<{ code: string; title: string; doneAt: string }>;
  months: SavingsMonth[];
  totals: { savedInr: number; savedKwh: number; savedTco2: number; verifiedInr: number };
  thisMonth: { month: string; savedInr: number; status: SavingsStatus } | null;
  methodNote: string;
  reason?: string;
  reasonCode?: 'no_baseline' | 'no_action_done' | 'no_savings_yet';
}

export function useSavings() {
  const siteId = getSession()?.siteId ?? '';
  return useQuery({
    queryKey: ['savings', siteId],
    queryFn: () => api<Savings>(`/sites/${siteId}/savings`),
  });
}

// Shape of GET /sites/:siteId/reports.
export interface ReportRow {
  id: string;
  type: string;
  version: number;
  createdAt: string;
  actionCode: string | null;
  shareCount: number;
  viewCount: number;
}

export function useReports() {
  const siteId = getSession()?.siteId ?? '';
  return useQuery({
    queryKey: ['reports', siteId],
    queryFn: () => api<ReportRow[]>(`/sites/${siteId}/reports`),
  });
}
