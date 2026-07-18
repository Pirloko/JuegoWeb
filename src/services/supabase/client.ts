import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * Cliente Supabase perezoso: la app funciona sin backend hasta la FASE 7.
 * Lanza con mensaje claro si se usa sin configurar el .env.
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error(
        'Supabase no configurado: define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env (ver .env.example)',
      );
    }
    client = createClient(url, anonKey);
  }
  return client;
}
