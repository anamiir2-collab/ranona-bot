import { supabase } from './supabase.js';
import { logger } from '../utils/logger.js';

export interface LeaderboardRow {
  telegram_user_id: number;
  total_points: number;
  rank: number;
}

export async function getGlobalLeaderboard(limit = 10) {
  const { data, error } = await supabase()
    .from('users')
    .select('telegram_id, username, first_name, last_name, points, games_won')
    .order('points', { ascending: false })
    .limit(limit);
  if (error) {
    logger.error({ err: error }, 'getGlobalLeaderboard failed');
    return [];
  }
  return data ?? [];
}

export async function getGroupLeaderboard(telegram_chat_id: number, limit = 10) {
  // Based on group_members + users
  const { data, error } = await supabase()
    .rpc('get_group_leaderboard', { p_chat_id: telegram_chat_id, p_limit: limit });

  if (error) {
    // Fallback: query users that have warnings/games in this chat
    const fallback = await supabase()
      .from('users')
      .select('telegram_id, username, first_name, last_name, points, games_won')
      .order('points', { ascending: false })
      .limit(limit);
    if (fallback.error) {
      logger.error({ err: fallback.error }, 'getGroupLeaderboard fallback failed');
      return [];
    }
    return fallback.data ?? [];
  }
  return data ?? [];
}

export async function getUserRank(
  telegram_user_id: number,
  telegram_chat_id?: number,
): Promise<number> {
  if (telegram_chat_id) {
    const group = await getGroupLeaderboard(telegram_chat_id, 1000);
    const idx = group.findIndex(
      (r: { telegram_id?: number; telegram_user_id?: number }) =>
        r.telegram_id === telegram_user_id || r.telegram_user_id === telegram_user_id,
    );
    return idx >= 0 ? idx + 1 : 0;
  }
  // Global: count users with more points
  const { data: user } = await supabase()
    .from('users')
    .select('points')
    .eq('telegram_id', telegram_user_id)
    .maybeSingle();
  if (!user) return 0;
  const { count } = await supabase()
    .from('users')
    .select('*', { count: 'exact', head: true })
    .gt('points', user.points);
  return (count || 0) + 1;
}
