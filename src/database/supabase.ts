import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let client: SupabaseClient | null = null;

/**
 * Returns the shared Supabase client (service-role). Do not expose this
 * to the user-facing API; use it server-side only.
 */
export function supabase(): SupabaseClient {
  if (client) return client;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase URL or service role key is missing');
  }
  client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  logger.info('Supabase client initialised');
  return client;
}

/**
 * Lightweight health-check used by the bot at startup.
 */
export async function pingSupabase(): Promise<boolean> {
  try {
    const { error } = await supabase().from('users').select('id').limit(1);
    if (error) {
      logger.error({ err: error }, 'Supabase ping failed');
      return false;
    }
    return true;
  } catch (e) {
    logger.error({ err: e }, 'Supabase connection error');
    return false;
  }
}
