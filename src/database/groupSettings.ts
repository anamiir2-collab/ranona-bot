import { supabase } from './supabase.js';
import { DEFAULT_SETTINGS } from '../config/constants.js';
import { logger } from '../utils/logger.js';

export interface GroupSettingsRow {
  id: string;
  group_id: string;
  protection_enabled: boolean;
  anti_spam: boolean;
  anti_flood: boolean;
  anti_link: boolean;
  anti_forward: boolean;
  anti_bot: boolean;
  anti_mention: boolean;
  word_filter: boolean;
  flood_threshold: number;
  flood_window_seconds: number;
  spam_action: string;
  flood_action: string;
  link_action: string;
  forward_action: string;
  mention_action: string;
  welcome_enabled: boolean;
  welcome_message: string;
  rules: string | null;
  warn_limit: number;
  warn_action: string;
  mute_duration: number;
  music_enabled: boolean;
  music_control: string;
  games_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export async function ensureSettingsFor(
  group_id: string,
  telegram_chat_id: number,
): Promise<GroupSettingsRow | null> {
  // Try to read first
  const existing = await getSettingsByGroupId(group_id);
  if (existing) return existing;

  // Otherwise insert with defaults
  const { data, error } = await supabase()
    .from('group_settings')
    .insert({
      group_id,
      ...DEFAULT_SETTINGS,
    })
    .select()
    .single();

  if (error) {
    // Race condition: another process inserted concurrently. Re-read.
    if (error.code === '23505') {
      return getSettingsByGroupId(group_id);
    }
    logger.error({ err: error }, 'ensureSettingsFor failed');
    return null;
  }
  return data as GroupSettingsRow;
}

export async function getSettingsByGroupId(group_id: string): Promise<GroupSettingsRow | null> {
  const { data, error } = await supabase()
    .from('group_settings')
    .select('*')
    .eq('group_id', group_id)
    .maybeSingle();
  if (error) {
    logger.error({ err: error }, 'getSettingsByGroupId failed');
    return null;
  }
  return (data as GroupSettingsRow) ?? null;
}

export async function updateSettings(
  group_id: string,
  patch: Partial<GroupSettingsRow>,
): Promise<boolean> {
  const { error } = await supabase()
    .from('group_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('group_id', group_id);
  if (error) {
    logger.error({ err: error }, 'updateSettings failed');
    return false;
  }
  return true;
}

export async function toggleSetting(
  group_id: string,
  field: keyof GroupSettingsRow,
): Promise<GroupSettingsRow | null> {
  const current = await getSettingsByGroupId(group_id);
  if (!current) return null;
  const value = current[field];
  if (typeof value !== 'boolean') return null;
  const ok = await updateSettings(group_id, { [field]: !value } as Partial<GroupSettingsRow>);
  if (!ok) return null;
  return getSettingsByGroupId(group_id);
}
