import { useQuery } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { api } from './api';
import { getSession } from './session';

// Shape of GET /sites/:siteId/progress (apps/api/src/services/progress.ts).
export interface Progress {
  stage: 0 | 1 | 2 | 3 | 4 | 5;
  stageName: string | null;
  stages: Array<{
    n: 1 | 2 | 3 | 4 | 5;
    key: 'measured' | 'baseline' | 'saving' | 'finance' | 'buyer';
    reached: boolean;
    reachedAt: string | null;
    milestones: string[];
    unlocks: string;
  }>;
  milestones: Array<{ key: string; reached: boolean; reachedAt: string | null; source: string }>;
  next: { key: string; params: Record<string, string | number>; text: string; href: string };
  headroom: {
    foundInrPerMonth: number;
    startedInrPerMonth: number;
    onTableInrPerMonth: number;
    basis: string;
  };
  ritual: {
    month: string | null;
    billReceived: boolean;
    valuesConfirmed: boolean;
    billChecked: boolean;
    actionChosen: boolean;
  };
}

export function useProgress() {
  const siteId = getSession()?.siteId ?? '';
  return useQuery({
    queryKey: ['progress', siteId],
    queryFn: () => api<Progress>(`/sites/${siteId}/progress`),
  });
}

/** The single next step in the owner's language; the API's English text is the fallback. */
export function nextText(next: Progress['next'], t: TFunction): string {
  const { key, params } = next;
  if (key === 'startAction') {
    const title = t(`actions.name.${params.code}`, { defaultValue: String(params.title) });
    return t('progress.next.startAction', { title });
  }
  return t(`progress.next.${key}`, { ...params, defaultValue: next.text });
}

/**
 * The same step for the path line, which already says "Next:": the verb prefix is left off
 * ("Next: Reduce contracted demand", never "Next: Start: Reduce contracted demand").
 */
export function pathText(next: Progress['next'], t: TFunction): string {
  if (next.key === 'startAction') {
    return t(`actions.name.${next.params.code}`, { defaultValue: String(next.params.title) });
  }
  return nextText(next, t);
}

/** "12 Oct 2026" in the owner's language. */
export function milestoneDate(iso: string, lang: string): string {
  const locale = lang === 'te' ? 'te-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso));
}
