import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url: unknown = import.meta.env['VITE_SUPABASE_URL'];
const anonKey: unknown = import.meta.env['VITE_SUPABASE_ANON_KEY'];

/**
 * Zonder sleutels draait de app gewoon door: je plannen blijven dan in deze browser.
 * Zo kun je ook zonder account aan de slag.
 */
export const supabase: SupabaseClient | null =
  typeof url === 'string' && url !== '' && typeof anonKey === 'string' && anonKey !== ''
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;

export function requireSupabase(): SupabaseClient {
  if (supabase === null) throw new Error('Supabase is niet ingesteld; vul VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY in.');
  return supabase;
}
