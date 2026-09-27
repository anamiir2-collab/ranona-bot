import { Context } from 'telegraf';
import { requireAdmin } from './permissions.js';
import { resolveTarget, recordModerationAction } from './actions.js';
import { getGroupByChatId } from '../database/groups.js';
import { muteUser, unmuteUser } from '../database/moderation.js';
import { parseDuration } from '../utils/helpers.js';
import { DEFAULT_SETTINGS } from '../config/constants.js';

export async function handleMute(ctx: Context): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  const args = (ctx.message as any)?.text?.split(/\s+/).slice(1) ?? [];
  const durationArg = args.find((a: string) => /^\d+[smhd]?$/.test(a));
  const targetArg = args.find((a: string) => !/^\d+[smhd]?$/.test(a));
  const target = await resolveTarget(ctx, targetArg);
  if (!target) {
    await ctx.reply('استخدم: /mute @username 10m السبب  أو رد على رسالة العضو.');
    return;
  }
  const durationSec = parseDuration(durationArg) ?? DEFAULT_SETTINGS.mute_duration;
  const untilDate = Math.floor(Date.now() / 1000) + durationSec;
  const group = await getGroupByChatId(ctx.chat!.id);
  if (!group) return;

  try {
    await ctx.telegram.restrictChatMember(ctx.chat!.id, target.telegram_user_id, {
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
    await muteUser({
      group_id: group.id,
      telegram_chat_id: ctx.chat!.id,
      telegram_user_id: target.telegram_user_id,
      reason:
        args.filter((a: string) => a !== durationArg && a !== targetArg).join(' ') || undefined,
      muted_by: ctx.from!.id,
      duration_seconds: durationSec,
    });
    await recordModerationAction({
      telegram_chat_id: ctx.chat!.id,
      action: 'MUTE',
      target_user: target.telegram_user_id,
      performed_by: ctx.from!.id,
      metadata: { duration: durationSec },
    });
    await ctx.reply(`🔇 ${target.displayName} تم كتمه لمدة ${durationSec}s.`);
  } catch {
    await ctx.reply('فشل كتم العضو. تأكد من صلاحيات البوت.');
  }
}

export async function handleUnmute(ctx: Context): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  const args = (ctx.message as any)?.text?.split(/\s+/).slice(1) ?? [];
  const target = await resolveTarget(ctx, args[0]);
  if (!target) {
    await ctx.reply('استخدم: /unmute @username أو رد على رسالة العضو.');
    return;
  }
  try {
    await ctx.telegram.restrictChatMember(ctx.chat!.id, target.telegram_user_id, {
      permissions: {
        can_send_messages: true,
        can_send_audios: true,
        can_send_documents: true,
        can_send_photos: true,
        can_send_videos: true,
        can_send_video_notes: true,
        can_send_voice_notes: true,
        can_send_polls: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true,
        can_change_info: false,
        can_invite_users: true,
        can_pin_messages: false,
        can_manage_topics: false,
      },
    } as any);
    await unmuteUser(ctx.chat!.id, target.telegram_user_id);
    await recordModerationAction({
      telegram_chat_id: ctx.chat!.id,
      action: 'UNMUTE',
      target_user: target.telegram_user_id,
      performed_by: ctx.from!.id,
    });
    await ctx.reply(`🔊 ${target.displayName} تم رفع الكتم.`);
  } catch {
    await ctx.reply('فشل رفع الكتم. تأكد من صلاحيات البوت.');
  }
}
