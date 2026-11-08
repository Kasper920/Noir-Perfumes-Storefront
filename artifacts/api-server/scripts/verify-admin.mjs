import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { clerkClient } from '@clerk/express';
import { createClient } from '@supabase/supabase-js';

// Development-only API verification. Never use a real owner's identity.
assert.ok(process.env.CLERK_SECRET_KEY?.startsWith('sk_test_'), 'Use development Clerk only');
const db = createClient(new URL(process.env.SUPABASE_URL).origin, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const suffix = randomUUID().slice(0, 8);
const productId = `admin-verification-${suffix}`;
const messageId = randomUUID();
let uploadedImagePath;
const imageBucket = process.env.NOIR_PRODUCT_IMAGE_BUCKET || 'noir-product-images';
let user;
let token;
const call = async (path, method = 'GET', body) => {
  const response = await fetch(`http://localhost:80/api${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, data: await response.json() };
};
const check = (r) => { if (r.error) throw new Error('Synthetic database setup/cleanup failed'); return r.data; };

try {
  user = await clerkClient.users.createUser({
    emailAddress: [`noir-admin-test-${suffix}@example.com`],
    firstName: 'Synthetic', lastName: 'API verifier', skipPasswordRequirement: true,
  });
  const session = await clerkClient.sessions.createSession({ userId: user.id });
  token = (await clerkClient.sessions.getToken(session.id)).jwt;
  assert.equal((await call('/profile')).status, 200, 'Verified synthetic session creates customer');
  assert.equal((await call('/admin/products')).status, 403, 'Customer cannot list management catalog');
  check(await db.from('noir_profiles').update({ role: 'admin' }).eq('id', user.id));
  const products = await call('/admin/products');
  assert.equal(products.status, 200);
  const draft = {
    ...products.data[0], id: productId, version: 0, active: true,
    imagePath: null,
    name: { en: 'Synthetic API fragrance', ar: 'عطر اختبار' },
    variants: [{ size: '50ml', price: 3.127, stock: 3 }, { size: '100ml', price: 5.789, stock: 2 }],
  };
  const created = await call('/admin/products', 'POST', draft);
  assert.equal(created.status, 200, 'Admin creates localized product and variants');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==', 'base64');
  const imageResponse = await fetch(`http://localhost:80/api/admin/products/${productId}/image/${created.data.version}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
    body: png,
  });
  assert.equal(imageResponse.status, 200, 'Admin uploads a verified image through the protected API');
  const uploaded = await imageResponse.json();
  uploadedImagePath = uploaded.imagePath;
  assert.match(uploadedImagePath, new RegExp(`^${productId}/[a-f0-9]{32}\\.png$`));
  assert.equal(uploaded.version, created.data.version + 1);
  const savedImage = await db.storage.from(imageBucket).download(uploadedImagePath);
  assert.ok(!savedImage.error && savedImage.data, 'Uploaded image is present in Supabase Storage');
  const linked = (await call('/admin/products')).data.find((p) => p.id === productId);
  assert.equal(linked.imagePath, uploadedImagePath, 'Database product references the uploaded image');
  assert.equal(linked.imageUrl, uploaded.imageUrl);
  const order = await call('/orders', 'POST', {
    requestId: randomUUID(), name: 'Synthetic verifier', phone: '+965 00000000',
    address: 'Synthetic test address, not for delivery', payment: 'cash',
    items: [{ productId, size: '50ml', quantity: 1 }],
  });
  assert.equal(order.status, 201);
  assert.equal(order.data.total, 3.127);
  const oid = order.data.id;
  assert.equal((await call(`/admin/orders/${oid}`, 'PATCH', { status: 'processing' })).status, 200);
  assert.equal((await call(`/admin/orders/${oid}`, 'PATCH', { status: 'cancelled' })).status, 200);
  assert.equal((await call(`/admin/orders/${oid}`, 'PATCH', { status: 'cancelled' })).status, 200);
  assert.equal((await call(`/admin/orders/${oid}`, 'PATCH', { status: 'shipped' })).status, 409);
  const current = (await call('/admin/products')).data.find((p) => p.id === productId);
  assert.equal(current.variants.find((v) => v.size === '50ml').stock, 3, 'Cancel restores exactly once');
  assert.equal((await call('/admin/products', 'POST', { ...created.data, active: false })).status, 409, 'Stale edit cannot overwrite checkout stock');
  const archived = await call('/admin/products', 'POST', { ...current, active: false });
  assert.equal(archived.status, 200);
  assert.equal((await call('/catalog')).data.some((p) => p.id === productId), false);
  assert.equal((await call('/admin/products', 'POST', { ...archived.data, active: true })).status, 200);
  assert.equal((await call('/catalog')).data.some((p) => p.id === productId), true);
  assert.equal((await call('/contact', 'POST', {
    requestId: messageId, name: 'Synthetic verifier', email: `noir-admin-test-${suffix}@example.com`,
    message: 'Synthetic verification message, please ignore.',
  })).status, 201);
  assert.equal((await call('/admin/messages')).data.some((m) => m.id === messageId && !m.resolved), true);
  assert.equal((await call(`/admin/messages/${messageId}`, 'PATCH', { resolved: true })).data.resolved, true);
  assert.equal((await call(`/admin/messages/${messageId}`, 'PATCH', { resolved: false })).data.resolved, false);
  check(await db.from('noir_profiles').update({ role: 'customer' }).eq('id', user.id));
  assert.equal((await call('/profile', 'PATCH', { name: 'Synthetic verifier', phone: '', address: '', role: 'admin' })).data.role, 'customer', 'Profile cannot self-escalate');
  assert.equal((await call('/admin/orders')).status, 403, 'Role revocation is immediate');
  assert.equal((await call('/admin/products', 'POST', draft)).status, 403);
  console.log('PASS: authenticated admin create/edit/archive/restore, uploaded product image in Supabase Storage with a saved public database reference, real stock prices, legal fulfillment/cancellation, message resolve/reopen, version conflicts, customer denial, role revocation and self-escalation protection.');
} catch (error) {
  console.error(error instanceof assert.AssertionError ? error.message : 'Admin verification failed; no secret or session details logged.');
  process.exitCode = 1;
} finally {
  check(await db.from('noir_messages').delete().eq('id', messageId));
  if (user) check(await db.from('noir_orders').delete().eq('customer_id', user.id));
  check(await db.from('noir_variants').delete().eq('product_id', productId));
  check(await db.from('noir_products').delete().eq('id', productId));
  if (uploadedImagePath) {
    const { error } = await db.storage.from(imageBucket).remove([uploadedImagePath]);
    if (error) throw new Error('Synthetic test image cleanup failed.');
  }
  if (user) {
    check(await db.from('noir_profiles').delete().eq('id', user.id));
    await clerkClient.users.deleteUser(user.id);
  }
}
