import { Context, Telegram } from 'telegraf';
import type { ChatMember } from '@telegraf/types';
import { isUserTrusted } from '../database/moderation.js';

export type PermissionKey =
  | 'can_delete_messages'
  | 'can_restrict_members'
  | 'can_ban_users'
  | 'can_pin_messages'
  | 'can_promote_members'
  | 'can_invite_users'
  | 'can_change_info';

/**
 * Check whether a user is an admin (creator / administrator) of the chat.
 */
export async function getChatMember(
  telegram: Telegram,
  chatId: number,
  userId: number,
): Promise<ChatMember | null> {
  try {
    return await telegram.getChatMember(chatId, userId);
  } catch {
    return null;
  }
}

export async function isAdmin(
  telegram: Telegram,
  chatId: number,
  userId: number,
): Promise<boolean> {
  const m = await getChatMember(telegram, chatId, userId);
  if (!m) return false;
  return m.status === 'creator' || m.status === 'administrator';
}

export async function isOwner(
  telegram: Telegram,
  chatId: number,
  userId: number,
): Promise<boolean> {
  const m = await getChatMember(telegram, chatId, userId);
  return m?.status === 'creator';
}

export async function isAdminOrTrusted(
  telegram: Telegram,
  chatId: number,
  userId: number,
): Promise<boolean> {
  const admin = await isAdmin(telegram, chatId, userId);
  if (admin) return true;
  return isUserTrusted(chatId, userId);
}

/**
 * Verify the bot itself has a specific permission.
 */
export async function botHasPermission(
  telegram: Telegram,
  chatId: number,
  permission: PermissionKey,
): Promise<boolean> {
  const me = await telegram.getMe();
  const m = await getChatMember(telegram, chatId, me.id);
  if (!m) return false;
  if (m.status === 'creator') return true;
  if (m.status !== 'administrator') return false;
  return Boolean((m as any)[permission]);
}

/**
 * Returns a list of missing permissions required for the full feature set.
 */
export async function missingPermissions(
  telegram: Telegram,
  chatId: number,
): Promise<PermissionKey[]> {
  const required: PermissionKey[] = [
    'can_delete_messages',
    'can_restrict_members',
    'can_ban_users',
    'can_pin_messages',
  ];
  const missing: PermissionKey[] = [];
  for (const p of required) {
    if (!(await botHasPermission(telegram, chatId, p))) missing.push(p);
  }
  return missing;
}

/**
 * Helper used inside command handlers.
 */
export async function requireAdmin(ctx: Context): Promise<boolean> {
  if (!ctx.chat || !ctx.from) return false;
  if (ctx.chat.type === 'private') {
    await ctx.reply('هذا الأمر متاح في الجروبات فقط.');
    return false;
  }
  const admin = await isAdmin(ctx.telegram, ctx.chat.id, ctx.from.id);
  if (!admin) {
    await ctx.reply('هذا الأمر مخصص للمشرفين.');
    return false;
  }
  return true;
}
