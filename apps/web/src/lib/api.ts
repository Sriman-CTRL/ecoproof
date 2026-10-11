import { getSession, setSession } from './session';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getSession()?.token;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Could not reach the server');
  }
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const e = (body ?? {}) as { code?: string; message?: string; details?: unknown };
    if (res.status === 401) setSession(null);
    throw new ApiError(res.status, e.code ?? 'ERROR', e.message ?? res.statusText, e.details);
  }
  return body as T;
}

export const postJson = <T>(path: string, data: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(data) });

// ---- response shapes (route shapes in apps/api/src/routes) ----
export interface MonthRow {
  month: string;
  rupees: { energyCharges: number | null; demandCharges: number | null; total: number | null };
  kwh: number | null;
  co2: { scope2TCo2Grid: number | null; scope1TCo2eFuels: number | null; label: string } | null;
  intensity: number | null;
  resultId: string | null;
}

export interface DocumentView {
  status: string;
  fields: Record<string, unknown> | null;
  confidence: Record<string, number> | null;
  lowConfidence: string[];
  validation: { errors: string[]; needsConfirmation: string[] };
  fileUrl: string | null;
}

export interface Explain {
  resultId: string;
  month: string;
  factors: Array<{
    id: string;
    sourceType: string;
    value: number;
    unit: string;
    version: string;
    source: string;
    status: string;
    gasBasis: string | null;
  }>;
  inputs: Array<{ kind: 'kwh' | 'litres' | 'tonnes'; value: number; qualityTag: string }>;
  formula: { scope2: string; scope1: string; intensity: string };
  formulaVersion: string;
}

export type UploadResponse = { documentId: string; status: string };
