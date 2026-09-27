import { supabase } from './supabase.js';
import { logger } from '../utils/logger.js';

// ============== BANNED USERS ==============
export interface BannedRow {
  id: string;
  telegram_chat_id: number;
  telegram_user_id: number;
  reason: string | null;
  banned_by: number;
  expires_at: string | null;
  created_at: string;
}

export async function banUser(input: {
  group_id: string;
  telegram_chat_id: number;
  telegram_user_id: number;
  reason?: string;
  banned_by: number;
  expires_at?: string | null;
}): Promise<boolean> {
  const { error } = await supabase().from('banned_users').insert({
    group_id: input.group_id,
    telegram_chat_id: input.telegram_chat_id,
    telegram_user_id: input.telegram_user_id,
    reason: input.reason ?? null,
    banned_by: input.banned_by,
    expires_at: input.expires_at ?? null,
  });
  if (error) {
    logger.error({ err: error }, 'banUser db failed');
    return false;
  }
  return true;
}

export async function unbanUser(telegram_chat_id: number, telegram_user_id: number): Promise<boolean> {
  const { error } = await supabase()
    .from('banned_users')
    .delete()
    .eq('telegram_chat_id', telegram_chat_id)
    .eq('telegram_user_id', telegram_user_id);
  if (error) {
    logger.error({ err: error }, 'unbanUser failed');
    return false;
  }
  return true;
}

// ============== MUTED USERS ==============
export interface MutedRow {
  id: string;
  telegram_chat_id: number;
  telegram_user_id: number;
  reason: string | null;
  muted_by: number;
  duration_seconds: number | null;
  expires_at: string | null;
  created_at: string;
}

export async function muteUser(input: {
  group_id: string;
  telegram_chat_id: number;
  telegram_user_id: number;
  reason?: string;
  muted_by: number;
  duration_seconds?: number;
}): Promise<boolean> {
  const expires_at = input.duration_seconds
    ? new Date(Date.now() + input.duration_seconds * 1000).toISOString()
    : null;
  const { error } = await supabase().from('muted_users').insert({
    group_id: input.group_id,
    telegram_chat_id: input.telegram_chat_id,
    telegram_user_id: input.telegram_user_id,
    reason: input.reason ?? null,
    muted_by: input.muted_by,
    duration_seconds: input.duration_seconds ?? null,
    expires_at,
  });
  if (error) {
    logger.error({ err: error }, 'muteUser db failed');
    return false;
  }
  return true;
}

export async function unmuteUser(
  telegram_chat_id: number,
  telegram_user_id: number,
): Promise<boolean> {
  const { error } = await supabase()
    .from('muted_users')
    .delete()
    .eq('telegram_chat_id', telegram_chat_id)
    .eq('telegram_user_id', telegram_user_id);
  if (error) {
    logger.error({ err: error }, 'unmuteUser failed');
    return false;
  }
  return true;
}

export async function isUserMuted(
  telegram_chat_id: number,
  telegram_user_id: number,
): Promise<boolean> {
  const { count, error } = await supabase()
    .from('muted_users')
    .select('*', { count: 'exact', head: true })
    .eq('telegram_chat_id', telegram_chat_id)
    .eq('telegram_user_id', telegram_user_id)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  if (error) {
    logger.error({ err: error }, 'isUserMuted failed');
    return false;
  }
  return (count || 0) > 0;
}

// ============== TRUSTED USERS ==============
export async function addTrustedUser(input: {
  group_id: string;
  telegram_chat_id: number;
  telegram_user_id: number;
  added_by: number;
}): Promise<boolean> {
  const { error } = await supabase()
    .from('trusted_users')
    .upsert(
      {
        group_id: input.group_id,
        telegram_chat_id: input.telegram_chat_id,
        telegram_user_id: input.telegram_user_id,
        added_by: input.added_by,
      },
      { onConflict: 'telegram_chat_id,telegram_user_id' },
    );
  if (error) {
    logger.error({ err: error }, 'addTrustedUser failed');
    return false;
  }
  return true;
}

export async function removeTrustedUser(
  telegram_chat_id: number,
  telegram_user_id: number,
): Promise<boolean> {
  const { error } = await supabase()
    .from('trusted_users')
    .delete()
    .eq('telegram_chat_id', telegram_chat_id)
    .eq('telegram_user_id', telegram_user_id);
  if (error) {
    logger.error({ err: error }, 'removeTrustedUser failed');
    return false;
  }
  return true;
}

export async function isUserTrusted(
  telegram_chat_id: number,
  telegram_user_id: number,
): Promise<boolean> {
  const { count, error } = await supabase()
    .from('trusted_users')
    .select('*', { count: 'exact', head: true })
    .eq('telegram_chat_id', telegram_chat_id)
    .eq('telegram_user_id', telegram_user_id);
  if (error) {
    logger.error({ err: error }, 'isUserTrusted failed');
    return false;
  }
  return (count || 0) > 0;
}
