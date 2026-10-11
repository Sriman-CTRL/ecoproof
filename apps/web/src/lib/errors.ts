import type { TFunction } from 'i18next';
import { ApiError } from './api';

/** One plain sentence: what happened and what to do. */
export function describeError(e: unknown, t: TFunction): string {
  if (e instanceof ApiError) {
    if (e.code === 'NETWORK') return t('common.networkError');
    if (e.status === 401) return t('common.sessionExpired');
    if (e.code === 'UNSUPPORTED_FILE') return t('bills.unsupported');
    if (e.code === 'FILE_TOO_LARGE') return t('bills.tooLarge');
    if (e.code === 'CONSENT_REQUIRED') return t('bills.consentNeeded');
    return e.message || t('common.genericError');
  }
  return t('common.genericError');
}
