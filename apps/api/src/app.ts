import cors from 'cors';
import express from 'express';
import { readFileSync } from 'node:fs';
import { config } from './config.js';
import { errorHandler } from './middleware/error.js';
import { authRouter } from './routes/auth.js';
import { consentsRouter } from './routes/consents.js';
import { documentsRouter } from './routes/documents.js';
import { resultsRouter } from './routes/results.js';
import { sitesRouter } from './routes/sites.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export function createApp() {
  const app = express();
  app.use(cors({ origin: config.WEB_ORIGIN }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: pkg.version });
  });

  app.use(authRouter, consentsRouter, documentsRouter, sitesRouter, resultsRouter);
  app.use(errorHandler);
  return app;
}
