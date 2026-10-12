import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { getSession } from './session';

// Shapes of GET /sites/:siteId/solar-plan and /solar-results (apps/api/src/services/solar.ts).
export interface SolarSource {
  key: string;
  value: number | null;
  unit: string | null;
  source: string;
  url: string | null;
  page: string | null;
  quotedLine: string | null;
  date: string | null;
}

export interface SolarPlan {
  kwp: number;
  limitedBy: 'roof' | 'use' | 'cap';
  belowMinimum: boolean;
  annualGenKwh: number;
  inputs: {
    annualKwh: number;
    billMonths: number;
    roofAreaM2: number;
    areaPerKwp: number;
    yieldKwhPerKwpYr: number;
    capKw: number;
    sanctionedLoadKw: number;
  };
  conservative: { areaPerKwp: number; kwp: number };
  rateInrPerKwh: number | null;
  monthlySavingInr: number | null;
  benchmarkCostInr: number;
  cfaInr: number;
  netCostInr: number;
  paybackYears: number | null;
  co2AvoidedT: number;
  conditions: string[];
  portalUrl: string;
  sources: SolarSource[];
}

export interface SolarMonth {
  month: string;
  importKwh: number;
  exportKwh: number;
  netKwh: number;
  billedKwh: number;
  lastYearKwh: number | null;
  savedKwh: number | null;
  billInr: number | null;
  lastYearBillInr: number | null;
  savedInr: number | null;
  gridTco2: number | null;
}

export interface SolarResults {
  installedKwp: number | null;
  installedFrom: string | null;
  months: SolarMonth[];
  totals: {
    importKwh: number | null;
    exportKwh: number | null;
    netKwh: number | null;
    savedKwh: number | null;
    billInr: number | null;
    savedInr: number | null;
    gridTco2: number | null;
  };
  status: 'verified' | 'too_early';
}

export function useSolarPlan() {
  const siteId = getSession()?.siteId ?? '';
  return useQuery({
    queryKey: ['solar-plan', siteId],
    queryFn: () => api<SolarPlan>(`/sites/${siteId}/solar-plan`),
  });
}

export function useSolarResults() {
  const siteId = getSession()?.siteId ?? '';
  return useQuery({
    queryKey: ['solar-results', siteId],
    queryFn: () => api<SolarResults>(`/sites/${siteId}/solar-results`),
  });
}
