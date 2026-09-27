import { Context } from 'telegraf';
import { requireAdmin } from './permissions.js';
import { resolveTarget, recordModerationAction } from './actions.js';
import { addTrustedUser, removeTrustedUser } from '../database/moderation.js';
import { getGroupByChatId } from '../database/groups.js';

export async function handlePromote(ctx: Context): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  const args = (ctx.message as any)?.text?.split(/\s+/).slice(1) ?? [];
  const target = await resolveTarget(ctx, args[0]);
  if (!target) {
    await ctx.reply('استخدم: /promote @username');
    return;
  }
  const group = await getGroupByChatId(ctx.chat!.id);
  if (!group) return;

  // 1) Try Telegram-side promote
  try {
    await ctx.telegram.promoteChatMember(ctx.chat!.id, target.telegram_user_id, {
      can_delete_messages: true,
      can_restrict_members: true,
      can_invite_users: true,
      can_change_info: false,
      can_pin_messages: true,
      can_promote_members: false,
      can_manage_topics: false,
    });
  } catch {
    // ignore - bot may not have can_promote_members; user is still trusted locally
  }
  // 2) Local trust
  await addTrustedUser({
    group_id: group.id,
    telegram_chat_id: ctx.chat!.id,
    telegram_user_id: target.telegram_user_id,
    added_by: ctx.from!.id,
  });
  await recordModerationAction({
    telegram_chat_id: ctx.chat!.id,
    action: 'PROMOTE',
    target_user: target.telegram_user_id,
    performed_by: ctx.from!.id,
  });
  await ctx.reply(`✅ ${target.displayName} أصبح مشرفًا موثوقًا.`);
}

export async function handleDemote(ctx: Context): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  const args = (ctx.message as any)?.text?.split(/\s+/).slice(1) ?? [];
  const target = await resolveTarget(ctx, args[0]);
  if (!target) {
    await ctx.reply('استخدم: /demote @username');
    return;
  }
  try {
    await ctx.telegram.promoteChatMember(ctx.chat!.id, target.telegram_user_id, {
      can_delete_messages: false,
      can_restrict_members: false,
      can_invite_users: false,
      can_change_info: false,
      can_pin_messages: false,
      can_promote_members: false,
      can_manage_topics: false,
    });
  } catch {
    // ignore - telegram may fail if bot lacks promote perms; still demote locally
  }
  await removeTrustedUser(ctx.chat!.id, target.telegram_user_id);
  await recordModerationAction({
    telegram_chat_id: ctx.chat!.id,
    action: 'DEMOTE',
    target_user: target.telegram_user_id,
    performed_by: ctx.from!.id,
  });
  await ctx.reply(`🔻 ${target.displayName} تم إزالة الصلاحية.`);
}
