import { prisma } from '../db.js';
import { notFound } from '../errors.js';

/** Every lookup is filtered by org: another org's id is indistinguishable from a missing one. */
export async function loadSite(orgId: string, siteId: string) {
  const site = await prisma.site.findFirst({ where: { id: siteId, orgId } });
  if (!site) throw notFound('Site');
  return site;
}

export async function loadDocument(orgId: string, documentId: string) {
  const doc = await prisma.document.findFirst({ where: { id: documentId, orgId } });
  if (!doc) throw notFound('Document');
  return doc;
}
