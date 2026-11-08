import { createClient } from '@supabase/supabase-js';

// Deliberately server-only: never expose this client or key through Vite.
export const supabase = createClient(
  new URL(required('SUPABASE_URL')).origin,
  required('SUPABASE_SERVICE_ROLE_KEY'),
  {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15_000) }) },
  },
);
export const PRODUCT_IMAGE_BUCKET = process.env.NOIR_PRODUCT_IMAGE_BUCKET || 'noir-product-images';
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

export class StoreError extends Error {
  constructor(public code: string, public status = 503) { super(code); }
}
export function checkDb(error: { message: string; code?: string } | null) {
  if (!error) return;
  const known = ['OUT_OF_STOCK', 'UNAVAILABLE', 'EDIT_CONFLICT', 'IDEMPOTENCY_CONFLICT', 'INVALID_STATUS', 'INVALID_ITEMS', 'INVALID_VARIANTS', 'INVALID_IMAGE_PATH', 'NOT_FOUND'];
  const code = known.find((name) => error.message.includes(name));
  throw new StoreError(code ?? 'STORE_UNAVAILABLE', code === 'NOT_FOUND' ? 404 : code ? 409 : 503);
}
