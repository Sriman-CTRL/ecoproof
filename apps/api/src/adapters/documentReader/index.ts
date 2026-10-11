import { config } from '../../config.js';
import { FakeReader } from './fake.js';
import { GeminiReader } from './gemini.js';
import type { DocumentReader } from './types.js';

export type { DocumentReader } from './types.js';

export function getDocumentReader(): DocumentReader {
  if (config.DOCUMENT_READER === 'gemini' && config.GEMINI_API_KEY) {
    return new GeminiReader(config.GEMINI_API_KEY);
  }
  return new FakeReader();
}
