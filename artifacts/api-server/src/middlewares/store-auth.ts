import { clerkClient, getAuth } from '@clerk/express';
import type { Request, Response, NextFunction } from 'express';
import type { Profile } from '@workspace/api-zod';
import { createHash } from 'node:crypto';
import { supabase, checkDb, StoreError } from '../lib/supabase';

declare global {
  namespace Express {
    interface Locals { profile?: Profile; }
  }
}
export async function customer(req: Request): Promise<Profile | null> {
  const { userId } = getAuth(req);
  if (!userId) return null;
  const { data, error } = await supabase.from('noir_profiles').select('*').eq('id', userId).maybeSingle();
  checkDb(error);
  const ownerEmail = process.env.NOIR_ADMIN_EMAIL?.trim().toLowerCase();
  const environment = process.env.CLERK_PUBLISHABLE_KEY?.startsWith('pk_live_') ? 'production' : 'development';
  const grantKey = createHash('sha256').update(`${environment}:${ownerEmail ?? ''}`).digest('hex');
  let needsGrant = false;
  if (ownerEmail) {
    const { data: grant, error: grantError } = await supabase.from('noir_owner_grants').select('grant_key').eq('grant_key', grantKey).maybeSingle();
    checkDb(grantError);
    needsGrant = !grant;
  }
  if (data && !needsGrant) return data as Profile;
  const user = await clerkClient.users.getUser(userId);
  const email = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId && e.verification?.status === 'verified');
  if (!email) throw new StoreError('EMAIL_VERIFICATION_REQUIRED', 403);
  const { error: insertError } = await supabase.from('noir_profiles').upsert({
    id: userId, email: email.emailAddress, name: [user.firstName, user.lastName].filter(Boolean).join(' '),
    role: 'customer',
  }, { onConflict: 'id', ignoreDuplicates: true });
  checkDb(insertError);
  if (needsGrant && email.emailAddress.toLowerCase() === ownerEmail) {
    const { error: grantError } = await supabase.rpc('noir_bootstrap_owner', { p_key: grantKey, p_user: userId });
    checkDb(grantError);
  }
  const { data: profile, error: readError } = await supabase.from('noir_profiles').select('*').eq('id', userId).single();
  checkDb(readError);
  return profile as Profile;
}
export async function requireCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await customer(req);
    if (!profile) { res.status(401).json({ error: 'SIGN_IN_REQUIRED' }); return; }
    res.locals.profile = profile;
    next();
  } catch (error) { next(error); }
}
export function requireAdmin(_req: Request, res: Response, next: NextFunction): void {
  if (res.locals.profile?.role !== 'admin') { res.status(403).json({ error: 'ADMIN_REQUIRED' }); return; }
  next();
}
