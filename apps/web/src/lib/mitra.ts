import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, postJson } from './api';
import type { ZedCard } from './schemes';
import { getSession } from './session';

/** D7 Mitra: free (₹0) NGO and government steps (apps/api/src/services/mitra.ts). */
export type MitraPage = 'ngo' | 'govt';
export type MitraStatus = 'not_started' | 'started' | 'done_self' | 'confirmed';
export type MitraKind = 'handoff' | 'link' | 'commitment' | 'visit' | 'learn';

export interface MitraItem {
  code: string;
  page: 'ngo' | 'govt' | 'both';
  kind: MitraKind;
  title: string;
  runBy: string;
  freeHelp: string;
  businessGain: string;
  carbonLine: string | null;
  howToStart: string;
  url: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  sourceUrl: string;
  lastChecked: string;
  datesUnconfirmed: boolean;
  status: MitraStatus;
  startedAt: string | null;
  updatedAt: string | null;
  hasProof: boolean;
  proofType: string | null;
  eventDate: string | null;
  packReportId: string | null;
  certificateReportId: string | null;
  requestPack?: RequestPackInfo | null;
}

export interface RequestPackInfo {
  reportId: string;
  verifyUrl: string;
  businessName: string;
  latestMonth: string;
  latestT: number;
  label: string;
  atStakeInr: number;
  topActionTitle: string | null;
  email: string;
  subject: string;
  /** Four lines; the owner sends it from their own mail app. */
  body: string;
}

/** mailto: link for the request pack (EcoProof never sends it). */
export const packMailto = (p: RequestPackInfo) =>
  `mailto:${p.email}?subject=${encodeURIComponent(p.subject)}&body=${encodeURIComponent(p.body)}`;

export interface PeerCase {
  code: string;
  company: string;
  place: string;
  actionCode: string | null;
  measure: string;
  investmentText: string;
  savingText: string | null;
  paybackText: string;
  beforeAfterText: string | null;
  source: string;
  sourceUrl: string;
  page: string | null;
  quotedLine: string;
}

export interface Commitment {
  baselineT: number;
  halfT: number;
  targetYear: number;
  periodFrom: string;
  periodTo: string;
  label: string;
  madeAt: string | null;
}

export interface MitraPageView {
  page: MitraPage;
  nextStep: { code: string; title: string; kind: MitraKind } | null;
  items: MitraItem[];
  doneCount: number;
  totalCount: number;
  commitment: Commitment | null;
  zed: ZedCard | null;
  peerCases: PeerCase[];
  notPartLine: string;
}

export interface MitraSummary {
  ngo: { done: number; total: number; next: { code: string; title: string } | null };
  govt: { done: number; total: number; next: { code: string; title: string } | null };
  next: { code: string; title: string; page: MitraPage } | null;
  followUp: { code: string; title: string; runBy: string; page: MitraPage } | null;
}

const siteId = () => getSession()?.siteId ?? '';

export function useMitraPage(page: MitraPage) {
  const id = siteId();
  return useQuery({
    queryKey: ['mitra', id, page],
    queryFn: () => api<MitraPageView>(`/sites/${id}/mitra?page=${page}`),
  });
}

export function useMitraSummary(enabled = true) {
  const id = siteId();
  return useQuery({
    queryKey: ['mitra', id, 'summary'],
    queryFn: () => api<MitraSummary>(`/sites/${id}/mitra/summary`),
    enabled,
  });
}

/** start / done on one step; refreshes both Mitra pages, the summary and the reports list. */
export function useMitraStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code, to }: { code: string; to: 'start' | 'done' }) =>
      postJson<MitraItem>(`/sites/${siteId()}/mitra/${code}/${to}`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mitra'] });
      void qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

/** Owner-entered "woman-owned unit" flag (ZED subsidy line). */
export function useWomenOwned() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (womenOwned: boolean) =>
      api<{ womenOwned: boolean }>('/org/profile', {
        method: 'PATCH',
        body: JSON.stringify({ womenOwned }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mitra'] });
      void qc.invalidateQueries({ queryKey: ['schemes'] });
    },
  });
}

/** Proof upload (or the labelled demo sample) -> confirmed + Certificate of Participation. */
export function useMitraProof() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      v:
        | { code: string; sample: true }
        | { code: string; file: File; proofType: string; eventDate: string },
    ) => {
      const path = `/sites/${siteId()}/mitra/${v.code}/proof`;
      if ('sample' in v) return postJson<MitraItem>(path, { sample: true });
      const form = new FormData();
      form.append('file', v.file);
      form.append('proofType', v.proofType);
      if (v.eventDate) form.append('eventDate', v.eventDate);
      return api<MitraItem>(path, { method: 'POST', body: form });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mitra'] });
      void qc.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}
