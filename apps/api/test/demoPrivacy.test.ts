import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { storage } from '../src/adapters/storage.js';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { resetDemo, seedDemo } from '../prisma/demo/seed-demo.js';

const app = createApp();
const sample = readFileSync(
  new URL('../prisma/demo/bills/bill-2026-10-clean.png', import.meta.url),
);
// Stands in for a judge's real bill photo: bytes that are not the sample bill.
const ownerPhoto = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff]),
  Buffer.from(`photo ${Date.now()}`),
]);

let token = '';
let siteId = '';

beforeAll(async () => {
  await resetDemo();
  await seedDemo();
  const r = await request(app).post('/auth/demo-login').send({ demo: 'A' });
  token = r.body.token;
  siteId = r.body.site.id;
});

afterAll(async () => {
  vi.restoreAllMocks();
  await resetDemo();
  await seedDemo();
  await prisma.$disconnect();
});

describe('demo mode upload privacy (DOCUMENT_READER=fake)', () => {
  it('reports the reader mode on /health', async () => {
    const r = await request(app).get('/health');
    expect(r.body.reader).toBe('fake');
  });

  it('stores the sample bill, never the uploaded photo', async () => {
    const put = vi.spyOn(storage, 'put');
    const r = await request(app)
      .post(`/sites/${siteId}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', ownerPhoto, { filename: 'photo.jpg', contentType: 'image/jpeg' });
    expect(r.status).toBe(202);

    expect(put).toHaveBeenCalledTimes(1);
    const [key, bytes, mime] = put.mock.calls[0]!;
    expect(Buffer.compare(bytes, sample)).toBe(0);
    expect(bytes.includes(ownerPhoto)).toBe(false);
    expect(mime).toBe('image/png');
    expect(key.endsWith('.png')).toBe(true);

    // A repeat upload of the same photo is still recognised by its hash.
    const sha = createHash('sha256').update(ownerPhoto).digest('hex');
    expect(key).toContain(sha);

    // Let the inline extract job finish before afterAll resets the demo.
    for (let i = 0; i < 60; i++) {
      const d = await request(app)
        .get(`/documents/${r.body.documentId}`)
        .set('Authorization', `Bearer ${token}`);
      if (d.body.status !== 'received' && d.body.status !== 'extracting') break;
      await new Promise((res) => setTimeout(res, 500));
    }
  });
});
