import { supabase } from './supabase.js';
import { logger } from '../utils/logger.js';

export interface UserRow {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  points: number;
  games_played: number;
  games_won: number;
  games_lost: number;
  correct_answers: number;
  wrong_answers: number;
  streak: number;
  created_at: string;
  updated_at: string;
}

export interface UpsertUserInput {
  telegram_id: number;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

/**
 * Insert or update a user. Returns the user row.
 */
export async function upsertUser(input: UpsertUserInput): Promise<UserRow | null> {
  const { data, error } = await supabase()
    .from('users')
    .upsert(
      {
        telegram_id: input.telegram_id,
        username: input.username ?? null,
        first_name: input.first_name ?? null,
        last_name: input.last_name ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'telegram_id' },
    )
    .select()
    .single();

  if (error) {
    logger.error({ err: error }, 'upsertUser failed');
    return null;
  }
  return data as UserRow;
}

export async function getUserByTelegramId(telegram_id: number): Promise<UserRow | null> {
  const { data, error } = await supabase()
    .from('users')
    .select('*')
    .eq('telegram_id', telegram_id)
    .maybeSingle();

  if (error) {
    logger.error({ err: error }, 'getUserByTelegramId failed');
    return null;
  }
  return (data as UserRow) ?? null;
}

export async function addPoints(telegram_id: number, delta: number): Promise<boolean> {
  const { error } = await supabase().rpc('increment_points', {
    p_telegram_id: telegram_id,
    p_delta: delta,
  });

  // RPC may not exist; fall back to a read-then-update.
  if (error) {
    const { data: row } = await supabase()
      .from('users')
      .select('points')
      .eq('telegram_id', telegram_id)
      .maybeSingle();
    if (!row) return false;
    const newPoints = Math.max(0, (row.points || 0) + delta);
    const { error: uErr } = await supabase()
      .from('users')
      .update({ points: newPoints, updated_at: new Date().toISOString() })
      .eq('telegram_id', telegram_id);
    if (uErr) {
      logger.error({ err: uErr }, 'addPoints fallback failed');
      return false;
    }
  }
  return true;
}

export async function incrementStat(
  telegram_id: number,
  field: 'games_played' | 'games_won' | 'games_lost' | 'correct_answers' | 'wrong_answers',
  by = 1,
): Promise<void> {
  const { data: row } = await supabase()
    .from('users')
    .select(field)
    .eq('telegram_id', telegram_id)
    .maybeSingle();
  if (!row) return;
  const current = (row as Record<string, unknown>)[field] as number | undefined;
  const next = (current || 0) + by;
  await supabase()
    .from('users')
    .update({ [field]: next, updated_at: new Date().toISOString() })
    .eq('telegram_id', telegram_id);
}

export async function setStreak(telegram_id: number, streak: number): Promise<void> {
  await supabase()
    .from('users')
    .update({ streak, updated_at: new Date().toISOString() })
    .eq('telegram_id', telegram_id);
}

export async function topUsers(limit = 10): Promise<UserRow[]> {
  const { data, error } = await supabase()
    .from('users')
    .select('*')
    .order('points', { ascending: false })
    .limit(limit);
  if (error) {
    logger.error({ err: error }, 'topUsers failed');
    return [];
  }
  return (data as UserRow[]) ?? [];
}
