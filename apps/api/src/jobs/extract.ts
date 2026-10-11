import { prisma } from '../db.js';
import { storage } from '../adapters/storage.js';
import { getDocumentReader } from '../adapters/documentReader/index.js';
import type { PowerBillReading } from '../adapters/documentReader/types.js';

const MAX_ATTEMPTS = 3;
const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  pdf: 'application/pdf',
};

/** Idempotent per document: only received / needs_manual documents are read. */
export async function extractJob({ documentId }: { documentId: string }): Promise<void> {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc || !['received', 'needs_manual'].includes(doc.status)) return;

  try {
    const bytes = await storage.get(doc.fileKey);
    const mime = MIME_BY_EXT[doc.fileKey.split('.').pop()?.toLowerCase() ?? ''] ?? 'image/png';
    const reader = getDocumentReader();
    let reading: PowerBillReading | null = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !reading; attempt++) {
      try {
        reading = await reader.readPowerBill(bytes, mime);
      } catch (e) {
        console.warn(`extract ${documentId}: attempt ${attempt} failed (${(e as Error).name})`);
      }
    }
    if (!reading) {
      await prisma.document.update({ where: { id: doc.id }, data: { status: 'needs_manual' } });
      return;
    }
    await prisma.$transaction([
      prisma.extraction.create({
        data: {
          orgId: doc.orgId,
          documentId: doc.id,
          model: reading.model,
          fieldsJson: reading.fields,
          confidenceJson: reading.confidence,
        },
      }),
      prisma.document.update({ where: { id: doc.id }, data: { status: 'extracted' } }),
    ]);
  } catch (e) {
    console.error(`extract ${documentId} failed`, e);
    await prisma.document.update({ where: { id: doc.id }, data: { status: 'needs_manual' } });
  }
}
