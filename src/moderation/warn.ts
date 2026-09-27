import { Context } from 'telegraf';
import { requireAdmin } from './permissions.js';
import { resolveTarget, recordModerationAction, applyWarnAction } from './actions.js';
import { getGroupByChatId } from '../database/groups.js';
import { addWarning, clearWarnings, countWarnings } from '../database/warnings.js';
import { upsertUser } from '../database/users.js';

export async function handleWarn(ctx: Context): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  const args = (ctx.message as any)?.text?.split(/\s+/).slice(1) ?? [];
  const target = await resolveTarget(ctx, args[0]);
  if (!target) {
    await ctx.reply('استخدم: /warn @username السبب  أو رد على رسالة العضو.');
    return;
  }
  const group = await getGroupByChatId(ctx.chat!.id);
  if (!group) return;
  const reason = args.slice(1).join(' ') || 'بدون سبب';
  const { total } = await addWarning({
    group_id: group.id,
    telegram_chat_id: ctx.chat!.id,
    telegram_user_id: target.telegram_user_id,
    reason,
    warned_by: ctx.from!.id,
  });
  await recordModerationAction({
    telegram_chat_id: ctx.chat!.id,
    action: 'WARN',
    target_user: target.telegram_user_id,
    performed_by: ctx.from!.id,
    reason,
    metadata: { total },
  });
  const action = await applyWarnAction(ctx, target.telegram_user_id, total);
  await ctx.reply(
    `⚠️ Warn ${total}\nUser: ${target.displayName}\nReason: ${reason}` +
      (action ? `\n\nتم تنفيذ: ${action}` : ''),
  );
}

export async function handleUnwarn(ctx: Context): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  const args = (ctx.message as any)?.text?.split(/\s+/).slice(1) ?? [];
  const target = await resolveTarget(ctx, args[0]);
  if (!target) {
    await ctx.reply('استخدم: /unwarn @username أو رد على رسالة العضو.');
    return;
  }
  const ok = await clearWarnings(ctx.chat!.id, target.telegram_user_id);
  if (!ok) {
    await ctx.reply('فشل حذف التحذيرات.');
    return;
  }
  await recordModerationAction({
    telegram_chat_id: ctx.chat!.id,
    action: 'UNWARN',
    target_user: target.telegram_user_id,
    performed_by: ctx.from!.id,
  });
  await ctx.reply(`تم إلغاء التحذيرات لـ ${target.displayName}.`);
}
