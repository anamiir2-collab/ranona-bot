import { supabase } from './supabase.js';
import { logger } from '../utils/logger.js';

export interface GroupRow {
  id: string;
  telegram_chat_id: number;
  title: string;
  type: string;
  owner_id: number | null;
  created_at: string;
  updated_at: string;
}

export async function upsertGroup(input: {
  telegram_chat_id: number;
  title: string;
  type: string;
  owner_id?: number | null;
}): Promise<GroupRow | null> {
  const { data, error } = await supabase()
    .from('groups')
    .upsert(
      {
        telegram_chat_id: input.telegram_chat_id,
        title: input.title,
        type: input.type,
        owner_id: input.owner_id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'telegram_chat_id' },
    )
    .select()
    .single();

  if (error) {
    logger.error({ err: error }, 'upsertGroup failed');
    return null;
  }
  return data as GroupRow;
}

export async function getGroupByChatId(telegram_chat_id: number): Promise<GroupRow | null> {
  const { data, error } = await supabase()
    .from('groups')
    .select('*')
    .eq('telegram_chat_id', telegram_chat_id)
    .maybeSingle();
  if (error) {
    logger.error({ err: error }, 'getGroupByChatId failed');
    return null;
  }
  return (data as GroupRow) ?? null;
}

export async function updateGroupTitle(telegram_chat_id: number, title: string): Promise<void> {
  await supabase()
    .from('groups')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('telegram_chat_id', telegram_chat_id);
}
