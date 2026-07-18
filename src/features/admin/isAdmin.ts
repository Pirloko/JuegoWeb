import type { User } from '@supabase/supabase-js';

/** Autorización solo vía app_metadata (nunca user_metadata). */
export function isAdminUser(user: User | null | undefined): boolean {
  return user?.app_metadata?.role === 'admin';
}
