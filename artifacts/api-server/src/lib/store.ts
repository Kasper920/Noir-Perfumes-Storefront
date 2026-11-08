import type { Product, Order, ContactMessage, Profile } from '@workspace/api-zod';
import { supabase, checkDb, StoreError, PRODUCT_IMAGE_BUCKET } from './supabase';

export async function catalog(admin = false): Promise<Product[]> {
  let query = supabase.from('noir_products').select('id,content,active,version,image_path,noir_variants(size,price,stock)').order('position').order('id');
  if (!admin) query = query.eq('active', true);
  const { data, error } = await query;
  checkDb(error);
  return (data ?? []).map((p) => ({
    ...p.content, id: p.id, active: p.active, version: p.version,
    imagePath: p.image_path ?? null,
    imageUrl: p.image_path ? supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(p.image_path).data.publicUrl : null,
    variants: p.noir_variants.map((v: { size: string; price: number; stock: number }) => ({ ...v, price: Number(v.price) })),
  }));
}
export const publicProfile = (p: Profile): Profile => ({
  id: p.id, email: p.email, name: p.name, phone: p.phone, address: p.address, role: p.role,
});
export function orderView(p: Record<string, unknown>): Order {
  return {
    id: String(p.id), reference: `N-${String(p.id).slice(0, 8).toUpperCase()}`,
    name: String(p.name), phone: String(p.phone), address: String(p.address),
    payment: p.payment as Order['payment'], status: p.status as Order['status'],
    total: Number(p.total), currency: String(p.currency), createdAt: String(p.created_at), items: p.items as Order['items'],
  };
}
export function messageView(p: Record<string, unknown>): ContactMessage {
  return { id: String(p.id), name: String(p.name), email: String(p.email), message: String(p.message), resolved: Boolean(p.resolved), createdAt: String(p.created_at) };
}
export async function oneOrder(id: string, customer?: string): Promise<Order> {
  let q = supabase.from('noir_orders').select('*').eq('id', id);
  if (customer) q = q.eq('customer_id', customer);
  const { data, error } = await q.maybeSingle();
  checkDb(error);
  if (!data) throw new StoreError('NOT_FOUND', 404);
  return orderView(data);
}
