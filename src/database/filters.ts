import { supabase } from './supabase.js';
import { logger } from '../utils/logger.js';

export interface FilterRow {
  id: string;
  group_id: string;
  telegram_chat_id: number;
  word: string;
  action: string;
  added_by: number;
  created_at: string;
}

export async function addFilter(input: {
  group_id: string;
  telegram_chat_id: number;
  word: string;
  action?: string;
  added_by: number;
}): Promise<FilterRow | null> {
  const { data, error } = await supabase()
    .from('filters')
    .upsert(
      {
        group_id: input.group_id,
        telegram_chat_id: input.telegram_chat_id,
        word: input.word.toLowerCase(),
        action: input.action || 'delete',
        added_by: input.added_by,
      },
      { onConflict: 'telegram_chat_id,word' },
    )
    .select()
    .single();
  if (error) {
    logger.error({ err: error }, 'addFilter failed');
    return null;
  }
  return data as FilterRow;
}

export async function removeFilter(
  telegram_chat_id: number,
  word: string,
): Promise<boolean> {
  const { error } = await supabase()
    .from('filters')
    .delete()
    .eq('telegram_chat_id', telegram_chat_id)
    .eq('word', word.toLowerCase());
  if (error) {
    logger.error({ err: error }, 'removeFilter failed');
    return false;
  }
  return true;
}

export async function listFilters(telegram_chat_id: number): Promise<FilterRow[]> {
  const { data, error } = await supabase()
    .from('filters')
    .select('*')
    .eq('telegram_chat_id', telegram_chat_id)
    .order('created_at', { ascending: false });
  if (error) {
    logger.error({ err: error }, 'listFilters failed');
    return [];
  }
  return (data as FilterRow[]) ?? [];
}

export async function findMatchingFilter(
  telegram_chat_id: number,
  text: string,
): Promise<FilterRow | null> {
  const filters = await listFilters(telegram_chat_id);
  if (filters.length === 0) return null;
  const lower = text.toLowerCase();
  return filters.find((f) => lower.includes(f.word.toLowerCase())) ?? null;
}
