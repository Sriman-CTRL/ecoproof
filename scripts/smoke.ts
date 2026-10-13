// Smoke test for a deployed EcoProof: pnpm smoke <apiUrl> <webUrl>
// Read-only: logs in as the demos and reads; never uploads or changes data.
import { DEMO_CARBON_STATEMENT_ID, DEMO_REPORT_ID } from '../apps/api/src/demo/ids.js';

const [apiArg, webArg] = process.argv.slice(2);
if (!apiArg || !webArg) {
  console.error('Usage: pnpm smoke <apiUrl> <webUrl>');
  process.exit(2);
}
const inr = (x: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(x);
const API = apiArg.replace(/\/$/, '');
const WEB = webArg.replace(/\/$/, '');

interface Result {
  name: string;
  ok: boolean;
  ms: number;
  note: string;
}
const results: Result[] = [];

async function check(name: string, fn: () => Promise<string>) {
  const t0 = performance.now();
  try {
    const note = await fn();
    results.push({ name, ok: true, ms: performance.now() - t0, note });
  } catch (e) {
    results.push({ name, ok: false, ms: performance.now() - t0, note: (e as Error).message });
  }
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 120)}`);
  return (await res.json()) as T;
}

interface Login {
  token: string;
  site: { id: string };
}
const login = (demo: 'A' | 'B' | 'H') =>
  getJson<Login>(`${API}/auth/demo-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ demo }),
  });
const auth = (l: Login) => ({ headers: { Authorization: `Bearer ${l.token}` } });

const sessions: Partial<Record<'A' | 'B' | 'H', Login>> = {};

// First call wakes a sleeping free-tier service: its time is the cold start.
await check('GET /health (first call)', async () => {
  const h = await getJson<{ status: string; reader?: string }>(`${API}/health`);
  if (h.status !== 'ok') throw new Error(`status ${h.status}`);
  return `reader=${h.reader ?? '?'}`;
});
await check('GET /health (warm)', async () => {
  await getJson(`${API}/health`);
  return '';
});
for (const demo of ['A', 'B', 'H'] as const) {
  await check(`demo login ${demo}`, async () => {
    sessions[demo] = await login(demo);
    return `site …${sessions[demo]!.site.id.slice(-4)}`;
  });
}
await check('Demo A insights: at stake', async () => {
  const a = sessions.A ?? (await login('A'));
  const r = await getJson<{ atStake: { inrPerMonth: number } }>(
    `${API}/sites/${a.site.id}/insights`,
    auth(a),
  );
  if (!(r.atStake.inrPerMonth > 0)) throw new Error(`at stake ${r.atStake.inrPerMonth}`);
  return `Rs ${inr(r.atStake.inrPerMonth)} a month`;
});
await check('Demo H solar plan', async () => {
  const h = sessions.H ?? (await login('H'));
  const r = await getJson<{ kwp: number; monthlySavingInr: number | null }>(
    `${API}/sites/${h.site.id}/solar-plan`,
    auth(h),
  );
  return `${r.kwp} kW, Rs ${r.monthlySavingInr == null ? '-' : inr(r.monthlySavingInr)} a month`;
});
await check('public verify (demo report)', async () => {
  await getJson(`${API}/public/reports/${DEMO_REPORT_ID}/verify`);
  return 'demo report';
});
await check('public verify (pitch QR, Demo A)', async () => {
  const r = await getJson<{ type: string; businessName: string; headline: { totalT: number } }>(
    `${API}/public/reports/${DEMO_CARBON_STATEMENT_ID}/verify`,
  );
  if (r.type !== 'carbon_statement') throw new Error(`type ${r.type}`);
  return `${r.businessName}, ${r.headline.totalT} t`;
});
await check('public sample (site figures)', async () => {
  const r = await getJson<{
    actions: Array<{ code: string; co2: { tPerYearLow: number; tPerYearHigh: number } | null }>;
  }>(`${API}/public/sample`);
  const igbt = r.actions.find((a) => a.code === 'igbt_furnace');
  if (!igbt?.co2) throw new Error('no igbt_furnace CO2');
  return `IGBT ${igbt.co2.tPerYearLow}-${igbt.co2.tPerYearHigh} t CO2/yr`;
});
for (const path of [
  '/',
  '/how-it-works',
  '/carbon-method',
  '/for-lenders',
  '/for-buyers',
  '/for-homes',
  '/about',
  '/household/solar',
  '/verify/<demo report>',
  '/verify/<pitch qr>',
]) {
  await check(`web ${path}`, async () => {
    const url = path
      .replace('<demo report>', DEMO_REPORT_ID)
      .replace('<pitch qr>', DEMO_CARBON_STATEMENT_ID);
    const res = await fetch(`${WEB}${url}`, {
      signal: AbortSignal.timeout(60_000),
    });
    if (res.status !== 200) throw new Error(`status ${res.status}`);
    if (!(await res.text()).includes('<div id="root">')) throw new Error('not the SPA index');
    return '200';
  });
}

for (const r of results) {
  console.log(
    `${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(34)} ${String(Math.round(r.ms)).padStart(6)} ms  ${r.note}`,
  );
}
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
