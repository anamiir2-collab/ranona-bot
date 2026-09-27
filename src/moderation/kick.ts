import { Context } from 'telegraf';
import { requireAdmin } from './permissions.js';
import { resolveTarget, recordModerationAction } from './actions.js';

export async function handleKick(ctx: Context): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  const args = (ctx.message as any)?.text?.split(/\s+/).slice(1) ?? [];
  const target = await resolveTarget(ctx, args[0]);
  if (!target) {
    await ctx.reply('استخدم: /kick @username السبب');
    return;
  }
  const reason = args.slice(1).join(' ') || 'بدون سبب';
  try {
    // ban then unban => equivalent to kick (member can rejoin)
    await ctx.telegram.banChatMember(ctx.chat!.id, target.telegram_user_id);
    await ctx.telegram.unbanChatMember(ctx.chat!.id, target.telegram_user_id);
    await recordModerationAction({
      telegram_chat_id: ctx.chat!.id,
      action: 'KICK',
      target_user: target.telegram_user_id,
      performed_by: ctx.from!.id,
      reason,
    });
    await ctx.reply(`👢 ${target.displayName} تم طرده.\nReason: ${reason}`);
  } catch {
    await ctx.reply('فشل طرد العضو. تأكد من صلاحيات البوت.');
  }
}
