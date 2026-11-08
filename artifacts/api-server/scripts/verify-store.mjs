import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const origin = new URL(process.env.SUPABASE_URL).origin;
const db = createClient(origin, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(origin, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const id = `verification-${randomUUID().slice(0, 8)}`;
const requests = [];
const messageId = randomUUID();
let cookie = '';
async function api(path, body, method = 'POST') {
  const response = await fetch(`http://localhost:80/api${path}`, {
    method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  return { status: response.status, data: await response.json() };
}
function ok(result) { if (result.error) throw new Error(`DB check failed: ${result.error.code}`); return result.data; }
try {
  const listed = await api('/catalog', undefined, 'GET');
  assert.equal(listed.status, 200);
  assert.ok(listed.data.some((p) => p.id === 'oud'));
  const { id: _, variants: _v, active: _a, version: _ver, ...content } = listed.data[0];
  content.name = { en: 'Verification fragrance', ar: 'عطر التحقق' };
  ok(await db.rpc('noir_save_product', { p_id: id, p_content: content, p_active: true, p_version: 0, p_variants: [
    { size: '50ml', price: 1.234, stock: 2 }, { size: '100ml', price: 2.345, stock: 1 },
  ] }));
  const order = (size = '50ml') => {
    const requestId = randomUUID(); requests.push(requestId);
    return { requestId, name: 'Verification customer', phone: '+965 50000000', address: 'Synthetic verification address', payment: 'cash', items: [{ productId: id, size, quantity: 1 }] };
  };
  const body = order();
  const saved = await api('/orders', { ...body, total: 0.001, customerId: 'spoofed', price: 0 });
  assert.equal(saved.status, 201);
  assert.equal(saved.data.total, 1.234);
  const retry = await api('/orders', body);
  assert.equal(retry.status, 201);
  assert.equal(retry.data.id, saved.data.id);
  assert.equal(ok(await db.from('noir_orders').select('id').eq('request_id', body.requestId)).length, 1);
  const conflict = await api('/orders', { ...body, name: 'Changed payload' });
  assert.equal(conflict.status, 409);
  const race = await Promise.all([api('/orders', order('100ml')), api('/orders', order('100ml'))]);
  assert.deepEqual(race.map((r) => r.status).sort(), [201, 409]);
  assert.equal(ok(await db.from('noir_variants').select('stock').eq('product_id', id).eq('size', '100ml').single()).stock, 0);
  const winner = race.find((r) => r.status === 201);
  ok(await db.rpc('noir_order_status', { p_id: winner.data.id, p_status: 'cancelled' }));
  ok(await db.rpc('noir_order_status', { p_id: winner.data.id, p_status: 'cancelled' }));
  assert.equal(ok(await db.from('noir_variants').select('stock').eq('product_id', id).eq('size', '100ml').single()).stock, 1);
  assert.ok((await db.rpc('noir_order_status', { p_id: winner.data.id, p_status: 'shipped' })).error);
  const invalid = await api('/orders', { ...order(), items: [{ productId: id, size: '50ml', quantity: -1 }] });
  assert.equal(invalid.status, 400);
  const contact = { requestId: messageId, name: 'Verification contact', email: 'verification@example.com', message: 'Synthetic contact verification only.' };
  assert.equal((await api('/contact', contact)).status, 201);
  assert.equal((await api('/contact', contact)).status, 201);
  assert.equal((await api('/contact', { ...contact, message: 'Different contact verification.' })).status, 409);
  assert.equal((await api('/contact', { ...contact, email: 'invalid' })).status, 400);
  assert.equal((await api('/admin/orders', undefined, 'GET')).status, 401);
  assert.equal((await api('/orders', undefined, 'GET')).status, 401);
  for (const table of ['noir_profiles', 'noir_orders', 'noir_messages', 'noir_owner_grants', 'noir_products', 'noir_variants']) {
    assert.ok((await anon.from(table).select('*').limit(1)).error, `${table} should deny public reads`);
  }
  assert.ok((await anon.rpc('noir_order_status', { p_id: saved.data.id, p_status: 'cancelled' })).error);
  const oldVersion = 1;
  assert.ok((await db.rpc('noir_save_product', { p_id: id, p_content: content, p_active: true, p_version: oldVersion, p_variants: [
    { size: '50ml', price: 1, stock: 99 }, { size: '100ml', price: 1, stock: 99 },
  ] })).error, 'A stale edit cannot overwrite checkout stock changes');
  process.stdout.write('PASS: persisted orders/contact, authoritative totals, idempotency, oversell protection, cancellation, stale edits, input validation, public data privacy and signed-out authorization.\n');
} finally {
  if (requests.length) ok(await db.from('noir_orders').delete().in('request_id', requests));
  ok(await db.from('noir_messages').delete().eq('id', messageId));
  ok(await db.from('noir_variants').delete().eq('product_id', id));
  ok(await db.from('noir_products').delete().eq('id', id));
}
