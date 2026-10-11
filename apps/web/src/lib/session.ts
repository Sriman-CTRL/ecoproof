export interface Session {
  token: string;
  siteId: string;
  orgName: string;
  demo: 'A' | 'B';
}

const KEY = 'ecoproof.session';

export function readStore(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStore(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage blocked: the app still works for this visit */
  }
}

// In-memory copy so the app works when storage is unavailable.
let memory: Session | null = null;

export function getSession(): Session | null {
  if (memory) return memory;
  const raw = readStore(KEY);
  if (!raw) return null;
  try {
    memory = JSON.parse(raw) as Session;
    return memory;
  } catch {
    return null;
  }
}

export function setSession(s: Session | null): void {
  memory = s;
  writeStore(KEY, s ? JSON.stringify(s) : null);
}
