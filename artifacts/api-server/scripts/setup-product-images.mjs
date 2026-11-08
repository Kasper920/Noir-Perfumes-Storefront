import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const projectUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!projectUrl || !serviceKey) throw new Error('Supabase server configuration is missing');

const bucketName = process.env.NOIR_PRODUCT_IMAGE_BUCKET || 'noir-product-images';
const imagePath = 'sprites/noir-product-grid.webp';
const productIds = ['oud', 'rose', 'amber', 'musk', 'night', 'bloom'];
const db = createClient(new URL(projectUrl).origin, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const throwIf = (error) => { if (error) throw new Error('Product image storage setup failed.'); };

const { data: buckets, error: listError } = await db.storage.listBuckets();
throwIf(listError);
const bucket = buckets.find(({ name }) => name === bucketName);
if (!bucket) {
  const { error } = await db.storage.createBucket(bucketName, {
    public: true, fileSizeLimit: '5MB',
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  });
  throwIf(error);
} else if (!bucket.public) {
  throw new Error('The existing NOIR product bucket is private; review its contents before changing access.');
} else {
  const { error } = await db.storage.updateBucket(bucketName, {
    public: true, fileSizeLimit: '5MB',
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  });
  throwIf(error);
}

const grid = await readFile(new URL('../../noir-perfumes/src/assets/noir-product-grid.webp', import.meta.url));
const { error: uploadError } = await db.storage.from(bucketName).upload(imagePath, grid, {
  contentType: 'image/webp', cacheControl: '31536000', upsert: true,
});
throwIf(uploadError);

const { data: existing, error: selectError } = await db.from('noir_products').select('id,content,image_path').in('id', productIds);
throwIf(selectError);
let linked = 0;
for (const product of existing ?? []) {
  if (product.image_path || product.content?.imageKey !== product.id) continue;
  const { data, error } = await db.from('noir_products').update({ image_path: imagePath })
    .eq('id', product.id).is('image_path', null).select('id');
  throwIf(error);
  linked += data?.length ?? 0;
}
console.log(`Supabase Storage bucket ready; uploaded the catalog artwork and linked ${linked} existing product records.`);
