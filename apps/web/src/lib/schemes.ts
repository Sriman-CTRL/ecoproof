import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { getSession } from './session';

// Shape of GET /sites/:siteId/schemes (apps/api/src/services/schemes.ts).
export type SchemeStatus = 'likely' | 'check_lender' | 'check_office' | 'not_eligible';

export interface SchemeMatch {
  code: string;
  name: string;
  status: SchemeStatus;
  /** Fixed phrase from the API (Doc 02 FIN-1), English. */
  statusText: string;
  reason: string;
  benefit: string | null;
  rateNote: string | null;
  lastChecked: string | null;
  stale: boolean;
  sourceUrl: string | null;
}

export interface ZedCard {
  status: SchemeStatus;
  statusText: string;
  rewardInr: number;
  feesInr: { bronze: number; silver: number; gold: number };
  subsidyPct: number | null;
  udyamCategory: 'micro' | 'small' | 'medium' | null;
  womenOwned: boolean;
  scStOwned: boolean;
  scStExtraPct: number;
  scStApplied: boolean;
  womenOwnedLine: string | null;
  womenOwnedSourceUrl: string | null;
  rewardNote: string;
  bankConcessions: Array<{ bank: string; bronze: string; silver: string; gold: string }>;
  bankNote: string;
  sourceUrl: string | null;
  bankSourceUrl: string;
  lastChecked: string | null;
  stale: boolean;
}

export interface SchemesView {
  moneyFound: { inr: number; items: Array<{ code: string; label: string; inr: number }> };
  zed: ZedCard | null;
  matches: SchemeMatch[];
  topMatch: { code: string; sourceUrl: string | null } | null;
}

export function useSchemes() {
  const siteId = getSession()?.siteId ?? '';
  return useQuery({
    queryKey: ['schemes', siteId],
    queryFn: () => api<SchemesView>(`/sites/${siteId}/schemes`),
  });
}

// Shape of GET /cbam/cn-codes.
export interface CnCode {
  code: string;
  description: string;
  inScopeNow: boolean;
  proposedFrom: string | null;
  hasIndiaDefault: boolean;
}

export function useCnCodes() {
  return useQuery({
    queryKey: ['cbam-cn-codes'],
    queryFn: () => api<CnCode[]>('/cbam/cn-codes'),
    staleTime: Infinity,
  });
}
