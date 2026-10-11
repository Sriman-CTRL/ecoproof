import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

const client = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const bucket = () => client.storage.from(config.SUPABASE_STORAGE_BUCKET);

export const storage = {
  /** Keys are content-addressed, so an "already exists" answer is fine. */
  async put(key: string, bytes: Buffer, mime: string): Promise<void> {
    const { error } = await bucket().upload(key, bytes, { contentType: mime, upsert: false });
    if (error && !/already exists|Duplicate/i.test(error.message)) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }
  },
  async get(key: string): Promise<Buffer> {
    const { data, error } = await bucket().download(key);
    if (error || !data) throw new Error(`Storage download failed: ${error?.message ?? 'no data'}`);
    return Buffer.from(await data.arrayBuffer());
  },
  async signedUrl(key: string, seconds = 600): Promise<string> {
    const { data, error } = await bucket().createSignedUrl(key, seconds);
    if (error || !data) throw new Error(`Signed URL failed: ${error?.message ?? 'no data'}`);
    return data.signedUrl;
  },
};
