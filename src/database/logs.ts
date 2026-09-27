import { supabase } from './supabase.js';
import { logger } from '../utils/logger.js';

export interface LogRow {
  id: string;
  group_id: string | null;
  telegram_chat_id: number | null;
  action: string;
  target_user: number | null;
  performed_by: number | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export async function writeLog(input: {
  group_id?: string | null;
  telegram_chat_id?: number | null;
  action: string;
  target_user?: number | null;
  performed_by?: number | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  const { error } = await supabase().from('logs').insert({
    group_id: input.group_id ?? null,
    telegram_chat_id: input.telegram_chat_id ?? null,
    action: input.action,
    target_user: input.target_user ?? null,
    performed_by: input.performed_by ?? null,
    reason: input.reason ?? null,
    metadata: input.metadata ?? null,
  });
  if (error) logger.error({ err: error }, 'writeLog failed');
}

export async function recentLogs(
  telegram_chat_id: number,
  limit = 20,
): Promise<LogRow[]> {
  const { data, error } = await supabase()
    .from('logs')
    .select('*')
    .eq('telegram_chat_id', telegram_chat_id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    logger.error({ err: error }, 'recentLogs failed');
    return [];
  }
  return (data as LogRow[]) ?? [];
}
