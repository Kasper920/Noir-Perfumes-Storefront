import { Router, raw, type IRouter } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import {
  GetAuthConfigResponse, GetCatalogResponse, GetProfileResponse, UpdateProfileBody, UpdateProfileResponse,
  PlaceOrderBody, PlaceOrderResponse, GetMyOrdersResponse, GetMyOrderParams, GetMyOrderResponse,
  SendContactBody, SendContactResponse, GetAdminProductsResponse, SaveAdminProductBody, SaveAdminProductResponse,
  GetAdminOrdersResponse, UpdateAdminOrderParams, UpdateAdminOrderBody, UpdateAdminOrderResponse,
  GetAdminMessagesResponse, UpdateAdminMessageParams, UpdateAdminMessageBody, UpdateAdminMessageResponse,
  UploadAdminProductImageParams, UploadAdminProductImageResponse,
} from '@workspace/api-zod';
import { supabase, checkDb, StoreError, PRODUCT_IMAGE_BUCKET, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { catalog, oneOrder, orderView, publicProfile, messageView } from '../lib/store';
import { customer, requireCustomer, requireAdmin } from '../middlewares/store-auth';

const router: IRouter = Router();
const publicWrites = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'RATE_LIMITED' } });
const adminWrites = rateLimit({ windowMs: 60_000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'RATE_LIMITED' } });
const rawProductImage = raw({ type: 'application/octet-stream', limit: '5mb', inflate: false });
router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  if (typeof req.signedCookies?.noir_guest !== 'string') {
    const guest = randomUUID();
    req.signedCookies.noir_guest = guest;
    res.cookie('noir_guest', guest, { signed: true, httpOnly: true, secure: req.secure, sameSite: 'lax', maxAge: 30 * 86400_000, path: '/api' });
  }
  next();
});
router.get('/auth/config', (_req, res): void => {
  res.json(GetAuthConfigResponse.parse({ supabaseUrl: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY }));
});
router.get('/catalog', async (_req, res): Promise<void> => {
  res.json(GetCatalogResponse.parse(await catalog()));
});
router.get('/profile', requireCustomer, async (_req, res): Promise<void> => {
  res.json(GetProfileResponse.parse(publicProfile(res.locals.profile!)));
});
router.patch('/profile', publicWrites, requireCustomer, async (req, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) throw new StoreError('INVALID_INPUT', 400);
  const fields = Object.fromEntries(Object.entries(parsed.data).map(([k,v]) => [k,v.trim()]));
  if (fields.name!.length < 2) throw new StoreError('INVALID_INPUT', 400);
  const { data, error } = await res.locals.userDb!.from('noir_profiles').update(fields)
    .eq('auth_user_id', res.locals.authUserId!)
    .select('id,email,name,phone,address,role').single();
  checkDb(error);
  if (!data) throw new StoreError('PROFILE_NOT_FOUND', 404);
  res.json(UpdateProfileResponse.parse(publicProfile(data)));
});
router.post('/orders', publicWrites, async (req, res): Promise<void> => {
  const parsed = PlaceOrderBody.safeParse(req.body);
  if (!parsed.success) throw new StoreError('INVALID_INPUT', 400);
  const body = parsed.data;
  if (body.name.trim().length < 2 || body.address.trim().length < 5) throw new StoreError('INVALID_INPUT', 400);
  const profile = await customer(req, res);
  let guest = req.signedCookies?.noir_guest;
  if (typeof guest !== 'string') {
    guest = randomUUID();
    res.cookie('noir_guest', guest, { signed: true, httpOnly: true, secure: req.secure, sameSite: 'lax', maxAge: 30 * 86400_000, path: '/api' });
  }
  const hash = createHash('sha256').update(JSON.stringify({ ...body, identity: profile?.id ?? guest })).digest('hex');
  const { data, error } = await supabase.rpc('noir_place_order', {
    p_request: body.requestId, p_hash: hash, p_customer: profile?.id ?? null,
    p_name: body.name.trim(), p_phone: body.phone.trim(), p_address: body.address.trim(),
    p_payment: body.payment, p_items: body.items,
  });
  checkDb(error);
  res.status(201).json(PlaceOrderResponse.parse(data));
});
router.get('/orders', requireCustomer, async (_req, res): Promise<void> => {
  const { data, error } = await res.locals.userDb!.from('noir_orders').select('*')
    .eq('customer_id', res.locals.profile!.id).order('created_at', { ascending: false }).limit(500);
  checkDb(error);
  res.json(GetMyOrdersResponse.parse((data ?? []).map(orderView)));
});
router.get('/orders/:id', requireCustomer, async (req, res): Promise<void> => {
  const params = GetMyOrderParams.safeParse(req.params);
  if (!params.success) throw new StoreError('INVALID_INPUT', 400);
  const { data, error } = await res.locals.userDb!.from('noir_orders').select('*')
    .eq('id', params.data.id).eq('customer_id', res.locals.profile!.id).maybeSingle();
  checkDb(error);
  if (!data) throw new StoreError('NOT_FOUND', 404);
  res.json(GetMyOrderResponse.parse(orderView(data)));
});
router.post('/contact', publicWrites, async (req, res): Promise<void> => {
  const parsed = SendContactBody.safeParse(req.body);
  if (!parsed.success) throw new StoreError('INVALID_INPUT', 400);
  const { requestId, name, email, message } = parsed.data;
  if (name.trim().length < 2 || message.trim().length < 10) throw new StoreError('INVALID_INPUT', 400);
  const request_hash = createHash('sha256').update(JSON.stringify({ name, email, message })).digest('hex');
  const { error } = await supabase.from('noir_messages').upsert({
    id: requestId, request_hash, name: name.trim(), email: email.trim(), message: message.trim(),
  }, { onConflict: 'id', ignoreDuplicates: true });
  checkDb(error);
  const { data, error: readError } = await supabase.from('noir_messages').select('request_hash').eq('id', requestId).single();
  checkDb(readError);
  if (data?.request_hash !== request_hash) throw new StoreError('IDEMPOTENCY_CONFLICT', 409);
  res.status(201).json(SendContactResponse.parse({ id: requestId }));
});
router.use('/admin', requireCustomer, requireAdmin, adminWrites);
router.get('/admin/products', async (_req, res): Promise<void> => {
  res.json(GetAdminProductsResponse.parse(await catalog(true)));
});
router.post('/admin/products', async (req, res): Promise<void> => {
  const parsed = SaveAdminProductBody.safeParse(req.body);
  if (!parsed.success) throw new StoreError('INVALID_INPUT', 400);
  const { id, active, version, variants, imagePath, ...content } = parsed.data;
  if (new Set(variants.map((v) => v.size)).size !== 2 ||
      [content.name.en, content.name.ar, content.description.en, content.description.ar].some((v) => !v.trim()) ||
      variants.some((v) => Math.abs(v.price * 1000 - Math.round(v.price * 1000)) > 0.00001)) {
    throw new StoreError('INVALID_INPUT', 400);
  }
  if (imagePath && !imagePath.startsWith(`${id}/`) && imagePath !== 'sprites/noir-product-grid.webp') throw new StoreError('INVALID_IMAGE_PATH', 400);
  const { error } = await supabase.rpc('noir_save_product_with_image', {
    p_id: id, p_content: content, p_active: active, p_version: version, p_variants: variants, p_image_path: imagePath,
  });
  checkDb(error);
  const saved = (await catalog(true)).find((p) => p.id === id);
  res.json(SaveAdminProductResponse.parse(saved));
});
router.put('/admin/products/:id/image/:version', rawProductImage, async (req, res): Promise<void> => {
  const params = UploadAdminProductImageParams.safeParse(req.params);
  if (!params.success || !Buffer.isBuffer(req.body) || req.body.length === 0) throw new StoreError('INVALID_IMAGE', 400);
  const file = req.body as Buffer;
  const png = file.length >= 8 && file.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg = file.length >= 3 && file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff;
  const webp = file.length >= 12 && file.toString('ascii', 0, 4) === 'RIFF' && file.toString('ascii', 8, 12) === 'WEBP';
  const type = png ? { mime: 'image/png', ext: 'png' } : jpeg ? { mime: 'image/jpeg', ext: 'jpg' } : webp ? { mime: 'image/webp', ext: 'webp' } : null;
  if (!type) throw new StoreError('INVALID_IMAGE', 415);
  const id = params.data.id;
  const imagePath = `${id}/${randomUUID().replaceAll('-', '')}.${type.ext}`;
  const storage = supabase.storage.from(PRODUCT_IMAGE_BUCKET);
  const { error: uploadError } = await storage.upload(imagePath, file, { contentType: type.mime, cacheControl: '31536000', upsert: false });
  if (uploadError) throw new StoreError('IMAGE_UPLOAD_FAILED', 503);
  const { data: version, error } = await supabase.rpc('noir_set_product_image', {
    p_id: id, p_expected_version: params.data.version, p_image_path: imagePath,
  });
  if (error) {
    await storage.remove([imagePath]);
    checkDb(error);
  }
  const imageUrl = storage.getPublicUrl(imagePath).data.publicUrl;
  res.json(UploadAdminProductImageResponse.parse({ imagePath, imageUrl, version }));
});
router.get('/admin/orders', async (_req, res): Promise<void> => {
  const { data, error } = await supabase.from('noir_orders').select('*').order('created_at', { ascending: false }).limit(500);
  checkDb(error);
  res.json(GetAdminOrdersResponse.parse((data ?? []).map(orderView)));
});
router.patch('/admin/orders/:id', async (req, res): Promise<void> => {
  const params = UpdateAdminOrderParams.safeParse(req.params);
  const body = UpdateAdminOrderBody.safeParse(req.body);
  if (!params.success || !body.success) throw new StoreError('INVALID_INPUT', 400);
  const { error } = await supabase.rpc('noir_order_status', { p_id: params.data.id, p_status: body.data.status });
  checkDb(error);
  res.json(UpdateAdminOrderResponse.parse(await oneOrder(params.data.id)));
});
router.get('/admin/messages', async (_req, res): Promise<void> => {
  const { data, error } = await supabase.from('noir_messages').select('*').order('created_at', { ascending: false }).limit(500);
  checkDb(error);
  res.json(GetAdminMessagesResponse.parse((data ?? []).map(messageView)));
});
router.patch('/admin/messages/:id', async (req, res): Promise<void> => {
  const params = UpdateAdminMessageParams.safeParse(req.params);
  const body = UpdateAdminMessageBody.safeParse(req.body);
  if (!params.success || !body.success) throw new StoreError('INVALID_INPUT', 400);
  const { data, error } = await supabase.from('noir_messages').update(body.data).eq('id', params.data.id).select('*').maybeSingle();
  checkDb(error);
  if (!data) throw new StoreError('NOT_FOUND', 404);
  res.json(UpdateAdminMessageResponse.parse(messageView(data)));
});
export default router;
