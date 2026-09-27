import { Context } from 'telegraf';
import { BRAND, PERMISSION_LABELS } from '../config/constants.js';
import { missingPermissions } from '../moderation/permissions.js';
import { getGroupByChatId } from '../database/groups.js';
import { getSettingsByGroupId } from '../database/groupSettings.js';
import { welcomeMessage, userDisplayName } from '../utils/formatters.js';

/**
 * Called when the bot is added to a group for the first time.
 */
export async function sendWelcomeOnAdd(ctx: Context): Promise<void> {
  if (!ctx.chat) return;
  const text = `${BRAND.NAME} is ready.\n${BRAND.TAGLINE}\n\nلتفعيل جميع الميزات، امنح البوت صلاحيات Administrator في إعدادات الجروب.`;
  await ctx.reply(text);

  // List missing permissions
  try {
    const missing = await missingPermissions(ctx.telegram, ctx.chat.id);
    if (missing.length > 0) {
      const labels = missing.map((p) => PERMISSION_LABELS[p] || p).join('، ');
      await ctx.reply(`Ranona يحتاج إلى الصلاحيات التالية: ${labels}.`);
    }
  } catch {
    // ignore - getChatMember may fail before bot is admin
  }
}

/**
 * Called for every new_chat_members event.
 */
export async function onNewMember(ctx: Context): Promise<void> {
  if (!ctx.chat || ctx.chat.type === 'private') return;
  const members = (ctx.message as any)?.new_chat_members as any[] | undefined;
  if (!members || members.length === 0) return;

  const group = await getGroupByChatId(ctx.chat.id);
  if (!group) return;
  const settings = await getSettingsByGroupId(group.id);
  if (!settings || !settings.welcome_enabled) return;

  for (const m of members) {
    if (m.is_bot) continue;
    const text = welcomeMessage(settings.welcome_message, {
      name: userDisplayName({
        username: m.username,
        first_name: m.first_name,
        last_name: m.last_name,
        id: m.id,
      }),
      username: m.username,
      group: ctx.chat.title || 'هذه المجموعة',
      id: m.id,
    });
    await ctx.reply(text).catch(() => undefined);
  }
}
