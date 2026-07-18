import { getSupabase } from '@/services/supabase/client';

export type FriendSiteTag = 'Amigo' | 'Recomendado';

export interface FriendSiteRow {
  id: string;
  name: string;
  blurb: string;
  url: string;
  tag: FriendSiteTag;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface FriendSiteWriteInput {
  name: string;
  blurb: string;
  url: string;
  tag: FriendSiteTag;
  sort_order: number;
  is_active: boolean;
}

/** Sitios activos para jugadores (Inicio, Niveles, Galería, Perfil…). */
export async function fetchActiveFriendSites(): Promise<FriendSiteRow[]> {
  const { data, error } = await getSupabase()
    .from('friend_sites')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data as FriendSiteRow[]) ?? [];
}

/** Lista completa para admin (incl. inactivos). */
export async function fetchFriendSitesAdmin(): Promise<FriendSiteRow[]> {
  const { data, error } = await getSupabase()
    .from('friend_sites')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data as FriendSiteRow[]) ?? [];
}

export async function createFriendSite(input: FriendSiteWriteInput): Promise<FriendSiteRow> {
  const { data, error } = await getSupabase()
    .from('friend_sites')
    .insert(input)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as FriendSiteRow;
}

export async function updateFriendSite(
  id: string,
  input: FriendSiteWriteInput,
): Promise<FriendSiteRow> {
  const { data, error } = await getSupabase()
    .from('friend_sites')
    .update(input)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as FriendSiteRow;
}

export async function deleteFriendSite(id: string): Promise<void> {
  const { error } = await getSupabase().from('friend_sites').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export function normalizeFriendSiteUrl(raw: string): string {
  let trimmed = raw.trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
  if (!trimmed) return '';

  // Pegados desde chat a veces vienen con mayúsculas o sin protocolo.
  if (/^https:\/\//i.test(trimmed)) {
    return trimmed.replace(/^https:\/\//i, 'https://');
  }
  if (/^http:\/\//i.test(trimmed)) {
    return trimmed.replace(/^http:\/\//i, 'https://');
  }
  // Quitar barras iniciales tipo //dominio.com
  trimmed = trimmed.replace(/^\/+/, '');
  return `https://${trimmed}`;
}

export function isValidFriendSiteUrl(url: string): boolean {
  if (!/^https:\/\//i.test(url)) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}
