import { getSupabase } from '@/services/supabase/client';

/** Elimina la cuenta del usuario autenticado (RPC) y cierra sesión local. */
export async function deleteOwnAccount(): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw new Error(error.message);
  await supabase.auth.signOut();
}
