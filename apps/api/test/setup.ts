// Must run before src/config.ts is imported: tests never call Gemini.
process.env.DOCUMENT_READER = 'fake';
