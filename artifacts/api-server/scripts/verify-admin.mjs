import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

assert.equal(process.env.NOIR_ALLOW_SYNTHETIC_AUTH_TESTS, '1', 'Set NOIR_ALLOW_SYNTHETIC_AUTH_TESTS=1 to create temporary Supabase Auth users');
const url = new URL(process.env.SUPABASE_URL).origin;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;
assert.ok(serviceKey && anonKey, 'Supabase server configuration is required');
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const suffix = randomUUID().slice(0, 8);
const email = `noir-admin-test-${suffix}@example.com`;
const password = `${randomUUID()}Aa1!`;
const productId = `admin-verification-${suffix}`;
const messageId = randomUUID();
const apiBase = process.env.NOIR_API_BASE_URL || 'http://localhost:80/api';
let user;
let profileId;
let token;
let uploadedImagePath;
const imageBucket = process.env.NOIR_PRODUCT_IMAGE_BUCKET || 'noir-product-images';
const call = async (path, method = 'GET', body) => {
  const response = await fetch(`${apiBase}${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, data: await response.json() };
};
const check = (result) => {
  if (result.error) throw new Error('Synthetic database setup/cleanup failed');
  return result.data;
};

try {
  const createdUser = await db.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: 'Synthetic API verifier' },
  });
  if (createdUser.error || !createdUser.data.user) throw new Error('Synthetic Supabase Auth setup failed');
  user = createdUser.data.user;
  const signedIn = await auth.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) throw new Error('Synthetic Supabase Auth sign-in failed');
  token = signedIn.data.session.access_token;

  const profile = await call('/profile');
  assert.equal(profile.status, 200, 'Verified Supabase session creates and reads its own customer profile');
  profileId = profile.data.id;
  assert.equal(profile.data.email, email);
  assert.equal((await call('/admin/products')).status, 403, 'Customer cannot list management catalog');
  check(await db.from('noir_profiles').update({ role: 'admin' }).eq('auth_user_id', user.id));

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
  const imageResponse = await fetch(`${apiBase}/admin/products/${productId}/image/${created.data.version}`, {
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
  const orderId = order.data.id;
  assert.equal((await call(`/admin/orders/${orderId}`, 'PATCH', { status: 'processing' })).status, 200);
  assert.equal((await call(`/admin/orders/${orderId}`, 'PATCH', { status: 'cancelled' })).status, 200);
  assert.equal((await call(`/admin/orders/${orderId}`, 'PATCH', { status: 'cancelled' })).status, 200);
  assert.equal((await call(`/admin/orders/${orderId}`, 'PATCH', { status: 'shipped' })).status, 409);
  const current = (await call('/admin/products')).data.find((p) => p.id === productId);
  assert.equal(current.variants.find((v) => v.size === '50ml').stock, 3, 'Cancel restores exactly once');
  assert.equal((await call('/admin/products', 'POST', { ...created.data, active: false })).status, 409, 'Stale edit cannot overwrite checkout stock');
  const archived = await call('/admin/products', 'POST', { ...current, active: false });
  assert.equal(archived.status, 200);
  assert.equal((await call('/catalog')).data.some((p) => p.id === productId), false);
  assert.equal((await call('/admin/products', 'POST', { ...archived.data, active: true })).status, 200);
  assert.equal((await call('/catalog')).data.some((p) => p.id === productId), true);
  assert.equal((await call('/contact', 'POST', {
    requestId: messageId, name: 'Synthetic verifier', email,
    message: 'Synthetic verification message, please ignore.',
  })).status, 201);
  assert.equal((await call('/admin/messages')).data.some((m) => m.id === messageId && !m.resolved), true);
  assert.equal((await call(`/admin/messages/${messageId}`, 'PATCH', { resolved: true })).data.resolved, true);
  assert.equal((await call(`/admin/messages/${messageId}`, 'PATCH', { resolved: false })).data.resolved, false);
  check(await db.from('noir_profiles').update({ role: 'customer' }).eq('auth_user_id', user.id));
  assert.equal((await call('/profile', 'PATCH', { name: 'Synthetic verifier', phone: '', address: '', role: 'admin' })).data.role, 'customer', 'Profile cannot self-escalate');
  assert.equal((await call('/admin/orders')).status, 403, 'Role revocation is immediate');
  assert.equal((await call('/admin/products', 'POST', draft)).status, 403);
  const signedOut = await auth.auth.signOut({ scope: 'local' });
  assert.equal(signedOut.error, null, 'Supabase client signs out cleanly');
  console.log('PASS: Supabase session verification, profile linking, role checks, admin catalog and image operations, order lifecycle, contact messages, self-escalation protection, and sign-out.');
} catch (error) {
  console.error(error instanceof assert.AssertionError ? error.message : 'Admin verification failed; no secret or session details logged.');
  process.exitCode = 1;
} finally {
  if (profileId) {
    check(await db.from('noir_orders').delete().eq('customer_id', profileId));
    check(await db.from('noir_profiles').update({ role: 'customer' }).eq('id', profileId));
    check(await db.from('noir_profiles').delete().eq('id', profileId));
  }
  check(await db.from('noir_messages').delete().eq('id', messageId));
  check(await db.from('noir_variants').delete().eq('product_id', productId));
  check(await db.from('noir_products').delete().eq('id', productId));
  if (uploadedImagePath) {
    const { error } = await db.storage.from(imageBucket).remove([uploadedImagePath]);
    if (error) throw new Error('Synthetic test image cleanup failed.');
  }
  if (user) {
    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) throw new Error('Synthetic Auth cleanup failed.');
  }
}
