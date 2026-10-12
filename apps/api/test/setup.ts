// Must run before src/config.ts is imported: tests never call Gemini.
process.env.DOCUMENT_READER = 'fake';
// Public routes are rate-limited per IP; tests make many calls from one IP.
process.env.PUBLIC_RATE_LIMIT_PER_MIN = '100000';
