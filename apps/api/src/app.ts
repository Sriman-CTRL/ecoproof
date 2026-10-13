import cors from 'cors';
import express from 'express';
import { readFileSync } from 'node:fs';
import { config } from './config.js';
import { errorHandler } from './middleware/error.js';
import { authRouter } from './routes/auth.js';
import { consentsRouter } from './routes/consents.js';
import { documentsRouter } from './routes/documents.js';
import { insightsRouter } from './routes/insights.js';
import { publicRouter } from './routes/public.js';
import { reportsRouter } from './routes/reports.js';
import { resultsRouter } from './routes/results.js';
import { mitraRouter } from './routes/mitra.js';
import { sitesRouter } from './routes/sites.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export function createApp() {
  const app = express();
  app.use(cors({ origin: config.WEB_ORIGINS }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    // No DB call: a cheap warm-up ping. `reader` tells the web whether uploads are read for real.
    res.json({ status: 'ok', version: pkg.version, reader: config.DOCUMENT_READER });
  });

  app.use(
    authRouter,
    consentsRouter,
    documentsRouter,
    sitesRouter,
    resultsRouter,
    insightsRouter,
    reportsRouter,
    mitraRouter,
    publicRouter,
  );
  app.use(errorHandler);
  return app;
}
