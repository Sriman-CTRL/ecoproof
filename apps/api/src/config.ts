import 'dotenv/config';
import { z } from 'zod';

const Env = z.object({
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1).optional(),
  DOCUMENT_READER: z.enum(['gemini', 'fake']).optional(),
  JWT_SECRET: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().min(1).default('http://localhost:5173'),
});

function load() {
  // Treat empty strings as unset so a blank .env line does not count as a value.
  const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ''));
  const parsed = Env.safeParse(raw);
  if (!parsed.success) {
    const keys = [...new Set(parsed.error.issues.map((i) => i.path.join('.')))];
    throw new Error(`Invalid environment, check: ${keys.join(', ')}`);
  }
  const env = parsed.data;
  const DOCUMENT_READER = env.DOCUMENT_READER ?? (env.GEMINI_API_KEY ? 'gemini' : 'fake');
  if (DOCUMENT_READER === 'gemini' && !env.GEMINI_API_KEY) {
    throw new Error(
      'Invalid environment, check: GEMINI_API_KEY (required when DOCUMENT_READER=gemini)',
    );
  }
  return { ...env, DOCUMENT_READER };
}

export const config = load();
