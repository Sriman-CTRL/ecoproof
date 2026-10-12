// Fixed demo identifiers (SYNTHETIC). Shared by prisma/demo/seed-demo.ts and demo login.
export const ORG_A = '5d3a0a10-0000-4000-8000-00000000000a';
export const ORG_B = '5d3a0a10-0000-4000-8000-00000000000b';
export const SITE_A = '5d3a0a10-0000-4000-8000-0000000000a1';
export const SITE_B = '5d3a0a10-0000-4000-8000-0000000000b1';
export const USER_A = '5d3a0a10-0000-4000-8000-0000000000a2';
export const USER_B = '5d3a0a10-0000-4000-8000-0000000000b2';
/** Demo B's loan-ready summary: fixed so the landing page QR (/verify/<id>) survives a reset. */
export const DEMO_REPORT_ID = '5d3a0a10-0000-4000-8000-0000000000c1';
export const DEMO_ORG_IDS = [ORG_A, ORG_B];

export const DEMOS = {
  A: { orgId: ORG_A, siteId: SITE_A, userId: USER_A },
  B: { orgId: ORG_B, siteId: SITE_B, userId: USER_B },
} as const;
