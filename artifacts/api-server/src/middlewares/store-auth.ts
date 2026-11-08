import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Request, Response, NextFunction } from 'express';
import type { Profile } from '@workspace/api-zod';
import { createHash } from 'node:crypto';
import { supabase, checkDb, StoreError, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';

declare global {
  namespace Express {
    interface Locals { profile?: Profile; userDb?: SupabaseClient; authUserId?: string; }
  }
}
export async function customer(req: Request, res: Response): Promise<Profile | null> {
  const authorization = req.get('authorization');
  if (!authorization) return null;
  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization.trim());
  if (!match) throw new StoreError('SIGN_IN_REQUIRED', 401);
  const token = match[1];
  const userDb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15_000) }),
    },
  });
  const { data: authData, error: authError } = await userDb.auth.getUser(token);
  const user = authData.user;
  if (authError || !user || !user.email) throw new StoreError('SIGN_IN_REQUIRED', 401);
  if (!user.email_confirmed_at) throw new StoreError('EMAIL_VERIFICATION_REQUIRED', 403);

  const fullName = user.user_metadata?.full_name;
  const name = typeof fullName === 'string' ? fullName.trim().slice(0, 100) : '';
  const { error: linkError } = await supabase.rpc('noir_link_supabase_profile', {
    p_auth_user: user.id, p_email: user.email, p_name: name,
  });
  checkDb(linkError);

  const ownerEmail = process.env.NOIR_ADMIN_EMAIL?.trim().toLowerCase();
  if (ownerEmail && user.email.toLowerCase() === ownerEmail) {
    const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
    const grantKey = createHash('sha256').update(`${environment}:${ownerEmail}`).digest('hex');
    const { data: grant, error: grantError } = await supabase.from('noir_owner_grants').select('grant_key').eq('grant_key', grantKey).maybeSingle();
    checkDb(grantError);
    if (!grant) {
      const linkedProfile = await supabase.from('noir_profiles').select('id').eq('auth_user_id', user.id).single();
      checkDb(linkedProfile.error);
      if (!linkedProfile.data) throw new StoreError('PROFILE_LINK_FAILED', 503);
      const { error: grantError } = await supabase.rpc('noir_bootstrap_owner', {
        p_key: grantKey, p_user: linkedProfile.data.id,
      });
      checkDb(grantError);
    }
  }

  res.locals.userDb = userDb;
  res.locals.authUserId = user.id;
  const { data: profile, error: readError } = await userDb.from('noir_profiles')
    .select('id,email,name,phone,address,role')
    .eq('auth_user_id', user.id)
    .single();
  checkDb(readError);
  return profile as Profile;
}
export async function requireCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await customer(req, res);
    if (!profile) { res.status(401).json({ error: 'SIGN_IN_REQUIRED' }); return; }
    res.locals.profile = profile;
    next();
  } catch (error) { next(error); }
}
export function requireAdmin(_req: Request, res: Response, next: NextFunction): void {
  if (res.locals.profile?.role !== 'admin') { res.status(403).json({ error: 'ADMIN_REQUIRED' }); return; }
  next();
}
