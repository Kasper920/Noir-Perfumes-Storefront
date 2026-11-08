import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createClient } from '@supabase/supabase-js';

// One-time catalog seed. ON CONFLICT DO NOTHING preserves all subsequent admin edits.
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Supabase server configuration is missing');
const source = await readFile(new URL('../../noir-perfumes/src/data/products.js', import.meta.url), 'utf8');
const array = source.slice(source.indexOf('export const products = ') + 'export const products = '.length, source.indexOf('\nexport const formatPrice')).replace(/;\s*$/, '');
const products = vm.runInNewContext(`(${array})`, { productGrid: 'existing-grid' });
const db = createClient(new URL(url).origin, key, { auth: { persistSession: false, autoRefreshToken: false } });
for (const [position, product] of products.entries()) {
  const { id, image, crop, prices, badge, ...content } = product;
  const { error } = await db.from('noir_products').upsert({
    id, content: { ...content, imageKey: id, ...(badge ? { badge } : {}) }, image_path: 'sprites/noir-product-grid.webp', active: true, position,
  }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw new Error('Catalog seed failed');
  const { error: variantError } = await db.from('noir_variants').upsert(
    Object.entries(prices).map(([size, price]) => ({ product_id: id, size, price, stock: 50 })),
    { onConflict: 'product_id,size', ignoreDuplicates: true },
  );
  if (variantError) throw new Error('Variant seed failed');
}
process.stdout.write('Catalog seed complete; existing products and stock preserved.\n');
