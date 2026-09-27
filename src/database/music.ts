import { supabase } from './supabase.js';
import { logger } from '../utils/logger.js';

export interface MusicSessionRow {
  id: string;
  group_id: string;
  telegram_chat_id: number;
  status: string;
  current_track: Record<string, unknown> | null;
  started_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface MusicQueueRow {
  id: string;
  session_id: string;
  telegram_chat_id: number;
  title: string;
  url: string;
  duration: number | null;
  requested_by: number;
  position: number;
  created_at: string;
}

export async function ensureSession(
  group_id: string,
  telegram_chat_id: number,
): Promise<MusicSessionRow | null> {
  const { data, error } = await supabase()
    .from('music_sessions')
    .upsert(
      {
        group_id,
        telegram_chat_id,
        status: 'idle',
      },
      { onConflict: 'telegram_chat_id' },
    )
    .select()
    .single();
  if (error) {
    logger.error({ err: error }, 'ensureSession failed');
    return null;
  }
  return data as MusicSessionRow;
}

export async function getSession(telegram_chat_id: number): Promise<MusicSessionRow | null> {
  const { data, error } = await supabase()
    .from('music_sessions')
    .select('*')
    .eq('telegram_chat_id', telegram_chat_id)
    .maybeSingle();
  if (error) {
    logger.error({ err: error }, 'getSession failed');
    return null;
  }
  return (data as MusicSessionRow) ?? null;
}

export async function updateSession(
  telegram_chat_id: number,
  patch: Partial<MusicSessionRow>,
): Promise<void> {
  await supabase()
    .from('music_sessions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('telegram_chat_id', telegram_chat_id);
}

export async function addToQueue(input: {
  session_id: string;
  telegram_chat_id: number;
  title: string;
  url: string;
  duration?: number;
  requested_by: number;
}): Promise<MusicQueueRow | null> {
  // Determine next position
  const { count } = await supabase()
    .from('music_queue')
    .select('*', { count: 'exact', head: true })
    .eq('telegram_chat_id', input.telegram_chat_id);
  const position = (count || 0) + 1;

  const { data, error } = await supabase()
    .from('music_queue')
    .insert({
      session_id: input.session_id,
      telegram_chat_id: input.telegram_chat_id,
      title: input.title,
      url: input.url,
      duration: input.duration ?? null,
      requested_by: input.requested_by,
      position,
    })
    .select()
    .single();
  if (error) {
    logger.error({ err: error }, 'addToQueue failed');
    return null;
  }
  return data as MusicQueueRow;
}

export async function listQueue(telegram_chat_id: number): Promise<MusicQueueRow[]> {
  const { data, error } = await supabase()
    .from('music_queue')
    .select('*')
    .eq('telegram_chat_id', telegram_chat_id)
    .order('position', { ascending: true });
  if (error) {
    logger.error({ err: error }, 'listQueue failed');
    return [];
  }
  return (data as MusicQueueRow[]) ?? [];
}

export async function popNextTrack(
  telegram_chat_id: number,
): Promise<MusicQueueRow | null> {
  const queue = await listQueue(telegram_chat_id);
  if (queue.length === 0) return null;
  const next = queue[0];
  await supabase().from('music_queue').delete().eq('id', next.id);
  // Re-index positions
  const remaining = await listQueue(telegram_chat_id);
  for (let i = 0; i < remaining.length; i++) {
    await supabase()
      .from('music_queue')
      .update({ position: i + 1 })
      .eq('id', remaining[i].id);
  }
  return next;
}

export async function clearQueue(telegram_chat_id: number): Promise<void> {
  await supabase().from('music_queue').delete().eq('telegram_chat_id', telegram_chat_id);
}

export async function removeTrack(
  telegram_chat_id: number,
  position: number,
): Promise<boolean> {
  const { error } = await supabase()
    .from('music_queue')
    .delete()
    .eq('telegram_chat_id', telegram_chat_id)
    .eq('position', position);
  if (error) {
    logger.error({ err: error }, 'removeTrack failed');
    return false;
  }
  // Re-index
  const remaining = await listQueue(telegram_chat_id);
  for (let i = 0; i < remaining.length; i++) {
    await supabase()
      .from('music_queue')
      .update({ position: i + 1 })
      .eq('id', remaining[i].id);
  }
  return true;
}
