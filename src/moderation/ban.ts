import { Context } from 'telegraf';
import { requireAdmin } from './permissions.js';
import { resolveTarget, recordModerationAction } from './actions.js';
import { getGroupByChatId } from '../database/groups.js';
import { banUser, unbanUser } from '../database/moderation.js';

export async function handleBan(ctx: Context): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  const args = (ctx.message as any)?.text?.split(/\s+/).slice(1) ?? [];
  const target = await resolveTarget(ctx, args[0]);
  if (!target) {
    await ctx.reply('استخدم: /ban @username السبب  أو رد على رسالة العضو.');
    return;
  }
  const group = await getGroupByChatId(ctx.chat!.id);
  if (!group) return;
  const reason = args.slice(1).join(' ') || 'بدون سبب';
  try {
    await ctx.telegram.banChatMember(ctx.chat!.id, target.telegram_user_id);
    await banUser({
      group_id: group.id,
      telegram_chat_id: ctx.chat!.id,
      telegram_user_id: target.telegram_user_id,
      reason,
      banned_by: ctx.from!.id,
    });
    await recordModerationAction({
      telegram_chat_id: ctx.chat!.id,
      action: 'BAN',
      target_user: target.telegram_user_id,
      performed_by: ctx.from!.id,
      reason,
    });
    await ctx.reply(`⛔ ${target.displayName} تم حظره.\nReason: ${reason}`);
  } catch {
    await ctx.reply('فشل حظر العضو. تأكد من صلاحيات البوت.');
  }
}

export async function handleUnban(ctx: Context): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  const args = (ctx.message as any)?.text?.split(/\s+/).slice(1) ?? [];
  const target = await resolveTarget(ctx, args[0]);
  if (!target) {
    await ctx.reply('استخدم: /unban @username');
    return;
  }
  try {
    await ctx.telegram.unbanChatMember(ctx.chat!.id, target.telegram_user_id);
    await unbanUser(ctx.chat!.id, target.telegram_user_id);
    await recordModerationAction({
      telegram_chat_id: ctx.chat!.id,
      action: 'UNBAN',
      target_user: target.telegram_user_id,
      performed_by: ctx.from!.id,
    });
    await ctx.reply(`✅ ${target.displayName} تم رفع الحظر.`);
  } catch {
    await ctx.reply('فشل رفع الحظر. تأكد من صلاحيات البوت.');
  }
}
