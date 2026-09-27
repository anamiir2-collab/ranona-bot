import { Context } from 'telegraf';
import { getGroupByChatId } from '../database/groups.js';
import { getSettingsByGroupId } from '../database/groupSettings.js';
import { writeLog } from '../database/logs.js';
import { logger } from '../utils/logger.js';

/**
 * Resolve a target user from a reply or argument.
 * Returns { telegram_user_id, displayName } or null.
 */
export async function resolveTarget(
  ctx: Context,
  arg?: string,
): Promise<{ telegram_user_id: number; displayName: string } | null> {
  // 1) Reply-based
  const reply = (ctx.message as any)?.reply_to_message;
  if (reply?.from) {
    return {
      telegram_user_id: reply.from.id,
      displayName: reply.from.username
        ? `@${reply.from.username}`
        : reply.from.first_name || `User #${reply.from.id}`,
    };
  }
  if (!arg) return null;

  // 2) Numeric Telegram ID
  if (/^\d+$/.test(arg)) {
    return { telegram_user_id: parseInt(arg, 10), displayName: `User #${arg}` };
  }

  // 3) Username
  if (arg.startsWith('@')) {
    try {
      const member = await ctx.telegram.getChatMember(ctx.chat!.id, arg.replace('@', '') as any);
      // telegraf may not resolve by username, so we accept failure gracefully
      if (member?.user) {
        return {
          telegram_user_id: member.user.id,
          displayName: `@${member.user.username || member.user.id}`,
        };
      }
    } catch {
      // fall through
    }
  }
  return null;
}

export async function recordModerationAction(input: {
  telegram_chat_id: number;
  action: string;
  target_user?: number | null;
  performed_by: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const group = await getGroupByChatId(input.telegram_chat_id);
  await writeLog({
    group_id: group?.id ?? null,
    telegram_chat_id: input.telegram_chat_id,
    action: input.action,
    target_user: input.target_user ?? null,
    performed_by: input.performed_by,
    reason: input.reason,
    metadata: input.metadata ?? null,
  });
}

/**
 * Apply the configured warn_action (mute / kick / ban) once a user
 * hits the warn limit.
 */
export async function applyWarnAction(
  ctx: Context,
  targetUserId: number,
  totalWarnings: number,
): Promise<string | null> {
  if (!ctx.chat || ctx.chat.type === 'private') return null;
  const group = await getGroupByChatId(ctx.chat.id);
  if (!group) return null;
  const settings = await getSettingsByGroupId(group.id);
  if (!settings) return null;
  if (totalWarnings < settings.warn_limit) return null;

  const reason = `تجاوز حد التحذيرات (${totalWarnings}/${settings.warn_limit})`;
  const untilDate = Math.floor(Date.now() / 1000) + (settings.mute_duration || 600);

  try {
    if (settings.warn_action === 'mute') {
      await ctx.telegram.restrictChatMember(ctx.chat.id, targetUserId, {
        permissions: {
          can_send_messages: false,
          can_send_audios: false,
          can_send_documents: false,
          can_send_photos: false,
          can_send_videos: false,
          can_send_video_notes: false,
          can_send_voice_notes: false,
          can_send_polls: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false,
          can_change_info: false,
          can_invite_users: false,
          can_pin_messages: false,
          can_manage_topics: false,
        },
        until_date: untilDate,
      } as any);
      const { muteUser } = await import('../database/moderation.js');
      await muteUser({
        group_id: group.id,
        telegram_chat_id: ctx.chat.id,
        telegram_user_id: targetUserId,
        reason,
        muted_by: ctx.from?.id ?? 0,
        duration_seconds: settings.mute_duration,
      });
      await recordModerationAction({
        telegram_chat_id: ctx.chat.id,
        action: 'MUTE',
        target_user: targetUserId,
        performed_by: ctx.from?.id ?? 0,
        reason,
      });
      return 'mute';
    }
    if (settings.warn_action === 'kick') {
      await ctx.telegram.banChatMember(ctx.chat.id, targetUserId);
      await ctx.telegram.unbanChatMember(ctx.chat.id, targetUserId);
      await recordModerationAction({
        telegram_chat_id: ctx.chat.id,
        action: 'KICK',
        target_user: targetUserId,
        performed_by: ctx.from?.id ?? 0,
        reason,
      });
      return 'kick';
    }
    if (settings.warn_action === 'ban') {
      await ctx.telegram.banChatMember(ctx.chat.id, targetUserId);
      const { banUser } = await import('../database/moderation.js');
      await banUser({
        group_id: group.id,
        telegram_chat_id: ctx.chat.id,
        telegram_user_id: targetUserId,
        reason,
        banned_by: ctx.from?.id ?? 0,
      });
      await recordModerationAction({
        telegram_chat_id: ctx.chat.id,
        action: 'BAN',
        target_user: targetUserId,
        performed_by: ctx.from?.id ?? 0,
        reason,
      });
      return 'ban';
    }
  } catch (e) {
    logger.error({ err: e }, 'applyWarnAction failed');
    return null;
  }
  return null;
}
