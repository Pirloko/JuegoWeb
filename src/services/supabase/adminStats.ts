import { getSupabase } from '@/services/supabase/client';

export interface AdminDashboardStats {
  window_days: number;
  users_total: number;
  users_new: number;
  users_returning: number;
  users_paid: number;
  play_time_ms_total: number;
  play_time_ms_window: number;
  sessions_count: number;
  levels_completed: number;
  attempts_total: number;
  subs_by_status: Record<string, number>;
}

export async function fetchAdminDashboardStats(days: number): Promise<AdminDashboardStats> {
  const { data, error } = await getSupabase().rpc('admin_dashboard_stats', {
    p_days: days,
  });
  if (error) throw new Error(error.message);
  const row = data as AdminDashboardStats;
  return {
    window_days: Number(row.window_days ?? days),
    users_total: Number(row.users_total ?? 0),
    users_new: Number(row.users_new ?? 0),
    users_returning: Number(row.users_returning ?? 0),
    users_paid: Number(row.users_paid ?? 0),
    play_time_ms_total: Number(row.play_time_ms_total ?? 0),
    play_time_ms_window: Number(row.play_time_ms_window ?? 0),
    sessions_count: Number(row.sessions_count ?? 0),
    levels_completed: Number(row.levels_completed ?? 0),
    attempts_total: Number(row.attempts_total ?? 0),
    subs_by_status: (row.subs_by_status ?? {}) as Record<string, number>,
  };
}

export type SubscriptionStatus = 'pending' | 'authorized' | 'paused' | 'cancelled';

export interface AdminSubscriptionRow {
  user_id: string;
  status: SubscriptionStatus;
  amount_clp: number;
  current_period_end: string | null;
  updated_at: string;
  username: string | null;
  email: string | null;
}

export async function fetchAdminSubscriptions(
  statusFilter?: SubscriptionStatus | 'all',
): Promise<AdminSubscriptionRow[]> {
  let q = getSupabase()
    .from('subscriptions')
    .select('user_id, status, amount_clp, current_period_end, updated_at')
    .order('updated_at', { ascending: false });

  if (statusFilter && statusFilter !== 'all') {
    q = q.eq('status', statusFilter);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.user_id as string);
  const { data: profiles, error: pErr } = await getSupabase()
    .from('profiles')
    .select('id, username')
    .in('id', ids);
  if (pErr) throw new Error(pErr.message);

  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p.username as string | null]));

  return rows.map((r) => ({
    user_id: r.user_id as string,
    status: r.status as SubscriptionStatus,
    amount_clp: Number(r.amount_clp),
    current_period_end: (r.current_period_end as string | null) ?? null,
    updated_at: r.updated_at as string,
    username: byId.get(r.user_id as string) ?? null,
    email: null,
  }));
}

export function formatPlayTime(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}
