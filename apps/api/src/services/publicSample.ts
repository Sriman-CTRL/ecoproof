import { prisma } from '../db.js';
import { ORG_A, ORG_H, SITE_A, SITE_H } from '../demo/ids.js';
import { listActions } from './actions.js';
import { computeCarbon } from './carbon.js';
import { BASELINE_RULES, resolveMonth } from './insights.js';
import { computeSolarPlan, computeSolarResults } from './solar.js';

// D6b: the public site's figures, read from the fixed SYNTHETIC demo orgs only (Demo A foundry,
// Demo H home) through the same services as the logged-in screens. No id comes from the request.

const TTL_MS = 60_000;
let cache: { at: number; body: unknown } | null = null;

async function build() {
  const [siteA, siteH] = await Promise.all([
    prisma.site.findFirstOrThrow({ where: { id: SITE_A, orgId: ORG_A } }),
    prisma.site.findFirstOrThrow({ where: { id: SITE_H, orgId: ORG_H } }),
  ]);
  const month = await resolveMonth(ORG_A, SITE_A);
  const [carbon, { actions }, solarPlan, solarResults] = await Promise.all([
    computeCarbon(siteA),
    listActions(siteA, month, null),
    computeSolarPlan(siteH),
    computeSolarResults(siteH),
  ]);
  const factors = await prisma.factor.findMany({
    where: { id: { in: [...new Set([...carbon.factorIds, ...(solarPlan.factorIds ?? [])])] } },
  });
  return {
    sample: true,
    carbon,
    factors: factors.map((f) => ({
      id: f.id,
      sourceType: f.sourceType,
      value: Number(f.value),
      unit: f.unit,
      version: f.version,
      source: f.source,
      sourceUrl: f.sourceUrl,
      page: f.page,
      quotedLine: f.quotedLine,
      status: f.status,
      gasBasis: f.gasBasis,
      basisNote: f.basisNote,
      validFrom: f.validFrom?.toISOString().slice(0, 10) ?? null,
      validTo: f.validTo?.toISOString().slice(0, 10) ?? null,
    })),
    actions,
    /** Doc 03 savings check (ASHRAE Guideline 14 monthly limits), as the savings service uses. */
    baselineRules: BASELINE_RULES,
    household: { plan: solarPlan, results: solarResults },
  };
}

/** Cached for a minute: the landing page is public and the free-tier database is small. */
export async function publicSample() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.body;
  const body = await build();
  cache = { at: Date.now(), body };
  return body;
}

export function clearPublicSampleCache() {
  cache = null;
}
