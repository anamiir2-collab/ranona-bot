import { Context } from 'telegraf';
import { BRAND } from '../config/constants.js';
import { mainMenuKeyboard } from '../bot/keyboards.js';
import { isGroupChat } from '../utils/helpers.js';
import { upsertGroup } from '../database/groups.js';
import { ensureSettingsFor } from '../database/groupSettings.js';
import { upsertUser } from '../database/users.js';
import { writeLog } from '../database/logs.js';
import { sendWelcomeOnAdd } from '../services/welcome.js';
import { logger } from '../utils/logger.js';

export async function handleStart(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  await upsertUser({
    telegram_id: ctx.from.id,
    username: ctx.from.username ?? null,
    first_name: ctx.from.first_name ?? null,
    last_name: ctx.from.last_name ?? null,
  });

  if (ctx.chat && isGroupChat(ctx.chat)) {
    const chat = ctx.chat as { id: number; title?: string; type: string };
    // When /start is invoked inside a group (typically only by admins),
    // make sure the group is registered.
    const group = await upsertGroup({
      telegram_chat_id: chat.id,
      title: chat.title || 'Untitled Group',
      type: chat.type,
      owner_id: null,
    });
    if (group) {
      await ensureSettingsFor(group.id, group.telegram_chat_id);
      await writeLog({
        group_id: group.id,
        telegram_chat_id: group.telegram_chat_id,
        action: 'BOT_STARTED',
        performed_by: ctx.from.id,
      });
    }
    await ctx.reply(`${BRAND.NAME} is ready.\n${BRAND.TAGLINE}\n\n/help — عرض الأوامر\n/settings — إعدادات الجروب`);
    return;
  }

  // Private chat
  await ctx.reply(`${BRAND.NAME}\n${BRAND.TAGLINE}`, mainMenuKeyboard());
}

/**
 * Triggered when the bot is added to a new group.
 */
export async function onAddedToGroup(ctx: Context): Promise<void> {
  if (!ctx.chat) return;
  const chat = ctx.chat as { id: number; title?: string; type: string };
  const group = await upsertGroup({
    telegram_chat_id: chat.id,
    title: chat.title || 'Untitled Group',
    type: chat.type,
  });
  if (group) {
    await ensureSettingsFor(group.id, group.telegram_chat_id);
    await writeLog({
      group_id: group.id,
      telegram_chat_id: group.telegram_chat_id,
      action: 'BOT_ADDED',
      performed_by: ctx.from?.id ?? null,
    });
  }
  await sendWelcomeOnAdd(ctx);
  logger.info({ chat_id: ctx.chat.id }, 'bot added to group');
}
