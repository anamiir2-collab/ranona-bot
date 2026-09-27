import { supabase } from './supabase.js';
import { logger } from '../utils/logger.js';

export interface WarningRow {
  id: string;
  group_id: string;
  telegram_chat_id: number;
  telegram_user_id: number;
  reason: string | null;
  warned_by: number;
  count: number;
  created_at: string;
}

export async function addWarning(input: {
  group_id: string;
  telegram_chat_id: number;
  telegram_user_id: number;
  reason?: string;
  warned_by: number;
}): Promise<{ total: number; latest: WarningRow | null }> {
  const { data, error } = await supabase()
    .from('warnings')
    .insert({
      group_id: input.group_id,
      telegram_chat_id: input.telegram_chat_id,
      telegram_user_id: input.telegram_user_id,
      reason: input.reason ?? null,
      warned_by: input.warned_by,
      count: 1,
    })
    .select()
    .single();

  if (error) {
    logger.error({ err: error }, 'addWarning failed');
  }

  const total = await countWarnings(input.telegram_chat_id, input.telegram_user_id);
  return { total, latest: (data as WarningRow) ?? null };
}

export async function countWarnings(
  telegram_chat_id: number,
  telegram_user_id: number,
): Promise<number> {
  const { count, error } = await supabase()
    .from('warnings')
    .select('*', { count: 'exact', head: true })
    .eq('telegram_chat_id', telegram_chat_id)
    .eq('telegram_user_id', telegram_user_id);
  if (error) {
    logger.error({ err: error }, 'countWarnings failed');
    return 0;
  }
  return count || 0;
}

export async function clearWarnings(
  telegram_chat_id: number,
  telegram_user_id: number,
): Promise<boolean> {
  const { error } = await supabase()
    .from('warnings')
    .delete()
    .eq('telegram_chat_id', telegram_chat_id)
    .eq('telegram_user_id', telegram_user_id);
  if (error) {
    logger.error({ err: error }, 'clearWarnings failed');
    return false;
  }
  return true;
}
