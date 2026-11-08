import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getAuthConfig, setAuthTokenGetter } from '@workspace/api-client-react';

let clientPromise: Promise<SupabaseClient> | null = null;

export function getSupabaseClient(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const config = await getAuthConfig();
      const client = createClient(config.supabaseUrl, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
      });
      setAuthTokenGetter(async () => (await client.auth.getSession()).data.session?.access_token ?? null);
      return client;
    })().catch((error: unknown) => {
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
}
