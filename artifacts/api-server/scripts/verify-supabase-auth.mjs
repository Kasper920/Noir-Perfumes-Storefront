import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

assert.equal(process.env.NOIR_ALLOW_SYNTHETIC_AUTH_TESTS, '1', 'Set NOIR_ALLOW_SYNTHETIC_AUTH_TESTS=1 to create temporary Supabase Auth users');
const url = new URL(process.env.SUPABASE_URL).origin;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;
assert.ok(serviceKey && anonKey, 'Supabase server configuration is required');
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const apiBase = process.env.NOIR_API_BASE_URL || 'http://localhost:80/api';
const suffix = randomUUID().slice(0, 8);
const productId = `auth-rls-verification-${suffix}`;
const password = `${randomUUID()}Aa1!`;
const users = [];
const profiles = [];
const orderIds = [];
let productCreated = false;
let phase = 'synthetic account creation';
const noError = (result, label) => {
  if (result.error) throw new Error(`${label} failed`);
  return result.data;
};
const safeAuthError = (error) => {
  const known = new Map([
    ['Invalid login credentials', 'invalid_credentials'],
    ['Email not confirmed', 'email_not_confirmed'],
    ['Invalid API key', 'invalid_api_key'],
    ['Signups not allowed for this instance', 'signups_disabled'],
  ]);
  return known.get(error?.message) || String(error?.status || 'unknown');
};
const createSyntheticUser = async (index) => {
  const email = `noir-auth-test-${suffix}-${index}@example.com`;
  phase = `create temporary account ${index}`;
  const { data, error } = await db.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: `Synthetic Customer ${index}` },
  });
  if (error || !data.user) throw new Error(`Supabase Auth admin error ${error?.code || 'unknown'}`);
  users.push({ user: data.user, email });
  phase = `sign in temporary account ${index}`;
  const signedIn = await anon.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) throw new Error(`Supabase Auth sign-in error ${safeAuthError(signedIn.error)}`);
  const token = signedIn.data.session.access_token;
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  return { ...users.at(-1), token, client };
};
const api = async (token, path, method = 'GET', body) => {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, data: await response.json() };
};

try {
  phase = 'create and sign in two users';
  const first = await createSyntheticUser(1);
  const second = await createSyntheticUser(2);
  const verifiedSession = await first.client.auth.getUser(first.token);
  assert.equal(verifiedSession.error, null, `Supabase token verification failed (${safeAuthError(verifiedSession.error)})`);
  phase = 'verified profile linking';
  const firstProfile = await api(first.token, '/profile');
  const secondProfile = await api(second.token, '/profile');
  assert.equal(firstProfile.status, 200, `First verified account reads its own profile (${firstProfile.data?.error || firstProfile.data?.code || 'no error code'})`);
  assert.equal(secondProfile.status, 200, `Second verified account reads its own profile (${secondProfile.data?.error || secondProfile.data?.code || 'no error code'})`);
  profiles.push(firstProfile.data.id, secondProfile.data.id);
  assert.notEqual(firstProfile.data.id, secondProfile.data.id, 'Each auth user has a separate profile');

  const firstOwn = noError(await first.client.from('noir_profiles').select('auth_user_id').eq('auth_user_id', first.user.id), 'First profile RLS read');
  const firstOther = noError(await first.client.from('noir_profiles').select('auth_user_id').eq('auth_user_id', second.user.id), 'First cross-profile RLS read');
  assert.equal(firstOwn.length, 1);
  assert.equal(firstOther.length, 0, 'First user cannot read the second user profile');
  const secondOther = noError(await second.client.from('noir_profiles').select('auth_user_id').eq('auth_user_id', first.user.id), 'Second cross-profile RLS read');
  assert.equal(secondOther.length, 0, 'Second user cannot read the first user profile');

  phase = 'favorites RLS';
  const catalog = await api(first.token, '/catalog');
  assert.equal(catalog.status, 200);
  assert.ok(catalog.data.length >= 2, 'The RLS check needs two existing catalog products');
  const firstProduct = catalog.data[0].id;
  const secondProduct = catalog.data[1].id;
  noError(await first.client.from('noir_favorites').insert({ user_id: first.user.id, product_id: firstProduct }), 'First own favorite insert');
  noError(await second.client.from('noir_favorites').insert({ user_id: second.user.id, product_id: secondProduct }), 'Second own favorite insert');
  const firstFavorites = noError(await first.client.from('noir_favorites').select('user_id,product_id'), 'First favorites RLS read');
  const secondFavorites = noError(await second.client.from('noir_favorites').select('user_id,product_id'), 'Second favorites RLS read');
  assert.deepEqual(firstFavorites.map((row) => row.user_id), [first.user.id]);
  assert.deepEqual(firstFavorites.map((row) => row.product_id), [firstProduct]);
  assert.deepEqual(secondFavorites.map((row) => row.user_id), [second.user.id]);
  assert.deepEqual(secondFavorites.map((row) => row.product_id), [secondProduct]);
  const crossFavorite = await first.client.from('noir_favorites').insert({ user_id: second.user.id, product_id: secondProduct });
  assert.ok(crossFavorite.error, 'A user cannot create another user favorite');
  assert.equal((await api(second.token, '/admin/products')).status, 403, 'A customer cannot access admin APIs');

  phase = 'temporary admin role and test product';
  noError(await db.from('noir_profiles').update({ role: 'admin' }).eq('auth_user_id', first.user.id), 'Temporary synthetic admin setup');
  const adminProducts = await api(first.token, '/admin/products');
  assert.equal(adminProducts.status, 200);
  const draft = {
    ...adminProducts.data[0], id: productId, version: 0, active: true, imagePath: null,
    name: { en: 'Synthetic RLS fragrance', ar: 'عطر اختبار' },
    variants: [{ size: '50ml', price: 1.239, stock: 10 }, { size: '100ml', price: 2.349, stock: 10 }],
  };
  const createdProduct = await api(first.token, '/admin/products', 'POST', draft);
  assert.equal(createdProduct.status, 200, 'Temporary admin creates a test-only product');
  productCreated = true;
  noError(await db.from('noir_profiles').update({ role: 'customer' }).eq('auth_user_id', first.user.id), 'Temporary admin role cleanup');

  phase = 'orders RLS';
  const makeOrder = (account, name) => api(account.token, '/orders', 'POST', {
    requestId: randomUUID(), name, phone: '+965 00000000', address: 'Synthetic test address, not for delivery',
    payment: 'cash', items: [{ productId, size: '50ml', quantity: 1 }],
  });
  const firstOrder = await makeOrder(first, 'Synthetic Customer 1');
  const secondOrder = await makeOrder(second, 'Synthetic Customer 2');
  assert.equal(firstOrder.status, 201);
  assert.equal(secondOrder.status, 201);
  orderIds.push(firstOrder.data.id, secondOrder.data.id);
  assert.equal((await api(first.token, `/orders/${secondOrder.data.id}`)).status, 404, 'A customer cannot fetch another user order by id');
  const firstOrders = await api(first.token, '/orders');
  const secondOrders = await api(second.token, '/orders');
  assert.equal(firstOrders.status, 200);
  assert.equal(secondOrders.status, 200);
  assert.ok(firstOrders.data.some((order) => order.id === firstOrder.data.id));
  assert.equal(firstOrders.data.some((order) => order.id === secondOrder.data.id), false);
  assert.ok(secondOrders.data.some((order) => order.id === secondOrder.data.id));
  assert.equal(secondOrders.data.some((order) => order.id === firstOrder.data.id), false);
  const firstDbOrders = noError(await first.client.from('noir_orders').select('customer_id'), 'First orders RLS read');
  const secondDbOrders = noError(await second.client.from('noir_orders').select('customer_id'), 'Second orders RLS read');
  assert.ok(firstDbOrders.every((order) => order.customer_id === firstProfile.data.id));
  assert.ok(secondDbOrders.every((order) => order.customer_id === secondProfile.data.id));

  assert.equal((await first.client.auth.signOut({ scope: 'local' })).error, null);
  assert.equal((await second.client.auth.signOut({ scope: 'local' })).error, null);
  console.log('PASS: two Supabase users, verified profile linking, favorites and orders isolated by RLS, cross-account access denied, admin APIs protected, and session sign-out.');
} catch (error) {
  const safeDetail = error instanceof Error && /^Supabase Auth (admin|sign-in) error (?:[A-Za-z0-9_]+|\d{3})$/.test(error.message) ? ` (${error.message})` : '';
  console.error(error instanceof assert.AssertionError ? error.message : `Supabase Auth/RLS verification failed during ${phase}${safeDetail}; no secret or session details logged.`);
  process.exitCode = 1;
} finally {
  for (const profileId of profiles) {
    noError(await db.from('noir_orders').delete().eq('customer_id', profileId), 'Synthetic order cleanup');
    noError(await db.from('noir_profiles').update({ role: 'customer' }).eq('id', profileId), 'Synthetic role cleanup');
    noError(await db.from('noir_profiles').delete().eq('id', profileId), 'Synthetic profile cleanup');
  }
  if (productCreated) {
    noError(await db.from('noir_variants').delete().eq('product_id', productId), 'Synthetic variant cleanup');
    noError(await db.from('noir_products').delete().eq('id', productId), 'Synthetic product cleanup');
  }
  for (const { user } of users) {
    noError(await db.from('noir_favorites').delete().eq('user_id', user.id), 'Synthetic favorite cleanup');
    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) throw new Error('Synthetic Auth cleanup failed.');
  }
}
