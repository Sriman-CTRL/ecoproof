import 'dotenv/config';

// Must run before src/config.ts is imported: tests never call Gemini.
process.env.DOCUMENT_READER = 'fake';
// Public routes are rate-limited per IP; tests make many calls from one IP.
process.env.PUBLIC_RATE_LIMIT_PER_MIN = '100000';

// Files run one at a time against the shared Supabase pooler: one connection per test process,
// and a longer connect timeout than Prisma's 5 s default for the Mumbai round trip.
if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('connection_limit', '1');
  if (!url.searchParams.has('connect_timeout')) url.searchParams.set('connect_timeout', '15');
  process.env.DATABASE_URL = url.toString();
}
