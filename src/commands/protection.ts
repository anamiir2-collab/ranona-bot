import { Context } from 'telegraf';
import { requireAdmin } from '../moderation/permissions.js';
import { addFilter, listFilters, removeFilter, findMatchingFilter } from '../database/filters.js';
import { getGroupByChatId } from '../database/groups.js';
import { getSettingsByGroupId } from '../database/groupSettings.js';
import { isAdminOrTrusted } from '../moderation/permissions.js';
import { recordModerationAction } from '../moderation/actions.js';
import { containsLink } from '../protection/antiLink.js';
import { isForwarded } from '../protection/antiForward.js';
import { isMentionSpam } from '../protection/antiMention.js';
import { detectSpam } from '../protection/antiSpam.js';
import { checkFlood } from '../protection/antiFlood.js';
import { muteUser, banUser } from '../database/moderation.js';
import { addWarning } from '../database/warnings.js';
import { writeLog } from '../database/logs.js';

export async function handleFilterAdd(ctx: Context): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  const args = (ctx.message as any)?.text?.split(/\s+/).slice(1) ?? [];
  if (args.length === 0) {
    await ctx.reply('استخدم: /filter <word>');
    return;
  }
  const word = args.join(' ').toLowerCase();
  const group = await getGroupByChatId(ctx.chat!.id);
  if (!group) return;
  const filter = await addFilter({
    group_id: group.id,
    telegram_chat_id: ctx.chat!.id,
    word,
    added_by: ctx.from!.id,
  });
  if (!filter) {
    await ctx.reply('فشل إضافة الكلمة.');
    return;
  }
  await recordModerationAction({
    telegram_chat_id: ctx.chat!.id,
    action: 'FILTER_ADD',
    target_user: null,
    performed_by: ctx.from!.id,
    reason: word,
  });
  await ctx.reply(`✅ تمت إضافة الكلمة المحظورة: ${word}`);
}

export async function handleFilterList(ctx: Context): Promise<void> {
  const filters = await listFilters(ctx.chat!.id);
  if (filters.length === 0) {
    await ctx.reply('لا توجد كلمات محظورة.');
    return;
  }
  const lines = ['الكلمات المحظورة:', '', ...filters.map((f) => `• ${f.word} — ${f.action}`)];
  await ctx.reply(lines.join('\n'));
}

export async function handleFilterRemove(ctx: Context): Promise<void> {
  if (!(await requireAdmin(ctx))) return;
  const args = (ctx.message as any)?.text?.split(/\s+/).slice(1) ?? [];
  if (args.length === 0) {
    await ctx.reply('استخدم: /unfilter <word>');
    return;
  }
  const word = args.join(' ').toLowerCase();
  const ok = await removeFilter(ctx.chat!.id, word);
  if (!ok) {
    await ctx.reply('فشل حذف الكلمة.');
    return;
  }
  await recordModerationAction({
    telegram_chat_id: ctx.chat!.id,
    action: 'FILTER_REMOVE',
    target_user: null,
    performed_by: ctx.from!.id,
    reason: word,
  });
  await ctx.reply(`🗑 تم حذف الكلمة: ${word}`);
}

/**
 * Apply protection rules to a single incoming message.
 * Returns true if the message should be deleted.
 */
export async function applyProtection(ctx: Context): Promise<void> {
  if (!ctx.chat || ctx.chat.type === 'private') return;
  if (!ctx.from) return;
  if (ctx.from.is_bot) return; // own / other bot messages are filtered separately

  const group = await getGroupByChatId(ctx.chat.id);
  if (!group) return;
  const settings = await getSettingsByGroupId(group.id);
  if (!settings || !settings.protection_enabled) return;

  // Admins and trusted users bypass all protection
  if (await isAdminOrTrusted(ctx.telegram, ctx.chat.id, ctx.from.id)) return;

  // 1) Anti Link
  if (settings.anti_link && containsLink(ctx)) {
    await executeAction(ctx, settings.link_action, 'إرسال رابط');
    return;
  }

  // 2) Anti Forward
  if (settings.anti_forward && isForwarded(ctx)) {
    await executeAction(ctx, settings.forward_action, 'رسالة محوّلة');
    return;
  }

  // 3) Anti Mention
  if (settings.anti_mention && isMentionSpam(ctx)) {
    await executeAction(ctx, settings.mention_action, 'mention spam');
    return;
  }

  // 4) Anti Spam
  if (settings.anti_spam && (await detectSpam(ctx))) {
    await executeAction(ctx, settings.spam_action, 'spam مكرر');
    return;
  }

  // 5) Anti Flood
  if (
    settings.anti_flood &&
    checkFlood(ctx, settings.flood_threshold, settings.flood_window_seconds * 1000)
  ) {
    await executeAction(ctx, settings.flood_action, 'flood');
    return;
  }

  // 6) Word Filter
  if (settings.word_filter) {
    const filter = await findMatchingFilter(
      ctx.chat.id,
      (ctx.message as any)?.text || '',
    );
    if (filter) {
      await executeAction(ctx, filter.action, `كلمة محظورة: ${filter.word}`);
      return;
    }
  }
}

async function executeAction(ctx: Context, action: string, reason: string): Promise<void> {
  try {
    if (action === 'delete' || action === 'warn' || action === 'mute' || action === 'ban') {
      await ctx.deleteMessage().catch(() => undefined);
    }
    if (action === 'warn' || action === 'mute' || action === 'ban') {
      const group = await getGroupByChatId(ctx.chat!.id);
      if (group) {
        const { total } = await addWarning({
          group_id: group.id,
          telegram_chat_id: ctx.chat!.id,
          telegram_user_id: ctx.from!.id,
          reason,
          warned_by: 0,
        });
        await ctx.reply(`⚠️ ${reason} — تحذير ${total}`).catch(() => undefined);
      }
    }
    if (action === 'mute') {
      const group = await getGroupByChatId(ctx.chat!.id);
      if (group) {
        try {
          await ctx.telegram.restrictChatMember(ctx.chat!.id, ctx.from!.id, {
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
            until_date: Math.floor(Date.now() / 1000) + 600,
          } as any);
          await muteUser({
            group_id: group.id,
            telegram_chat_id: ctx.chat!.id,
            telegram_user_id: ctx.from!.id,
            reason,
            muted_by: 0,
            duration_seconds: 600,
          });
        } catch {
          // bot may lack restrict permission
        }
      }
    }
    if (action === 'ban') {
      const group = await getGroupByChatId(ctx.chat!.id);
      if (group) {
        try {
          await ctx.telegram.banChatMember(ctx.chat!.id, ctx.from!.id);
          await banUser({
            group_id: group.id,
            telegram_chat_id: ctx.chat!.id,
            telegram_user_id: ctx.from!.id,
            reason,
            banned_by: 0,
          });
        } catch {
          // bot may lack ban permission
        }
      }
    }
  } catch {
    // swallow
  }
}
