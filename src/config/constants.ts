import { env } from './env.js';

/**
 * Ranona brand & identity constants.
 * Edit these values to rebrand the bot.
 */
export const BRAND = {
  NAME: 'Ranona',
  TAGLINE: 'Music • Games • Protection • Fun',
  EMOJI: '◆',
} as const;

export const LINKS = {
  DEVELOPER: env.DEVELOPER_USERNAME,
  CHANNEL: env.CHANNEL_USERNAME,
} as const;

export const COLORS = {
  primary: '#7C3AED',
  accent: '#06B6D4',
  dark: '#0F172A',
  light: '#F8FAFC',
  danger: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
} as const;

/** Telegram BotFather permission names mapped to human-readable Arabic labels. */
export const PERMISSION_LABELS: Record<string, string> = {
  can_delete_messages: 'حذف الرسائل',
  can_restrict_members: 'تقييد الأعضاء',
  can_ban_users: 'حظر المستخدمين',
  can_pin_messages: 'تثبيت الرسائل',
  can_promote_members: 'ترقية الأعضاء',
  can_invite_users: 'دعوة المستخدمين',
  can_change_info: 'تعديل معلومات المجموعة',
};

export const DEFAULT_SETTINGS = {
  protection_enabled: true,
  anti_spam: true,
  anti_flood: true,
  anti_link: true,
  anti_forward: false,
  anti_bot: true,
  anti_mention: true,
  word_filter: true,
  flood_threshold: 5,
  flood_window_seconds: 3,
  spam_action: 'delete',
  flood_action: 'warn',
  link_action: 'delete',
  forward_action: 'delete',
  mention_action: 'warn',
  welcome_enabled: true,
  welcome_message: 'أهلًا بك {name} في {group}',
  rules: '',
  warn_limit: 3,
  warn_action: 'mute',
  mute_duration: 600,
  music_enabled: true,
  music_control: 'everyone',
  games_enabled: true,
} as const;

/** Point values are configurable here. */
export const POINTS = {
  WIN: 10,
  CORRECT_ANSWER: 5,
  DAILY_CHALLENGE: 20,
  LOSE: 0,
} as const;

/** Rate limiting config (per user, per command). */
export const RATE_LIMIT = {
  WINDOW_MS: 5_000,
  MAX_REQUESTS: 3,
} as const;

export const WARN_ACTIONS = ['mute', 'kick', 'ban'] as const;
export const PROTECTION_ACTIONS = ['delete', 'warn', 'mute', 'ban'] as const;
