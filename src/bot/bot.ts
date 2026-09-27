import { Telegraf, Context } from 'telegraf';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { attachMiddlewares } from './middleware.js';

export type BotContext = Context;

let instance: Telegraf<BotContext> | null = null;

export function getBot(): Telegraf<BotContext> {
  if (instance) return instance;
  if (!env.BOT_TOKEN) {
    throw new Error('BOT_TOKEN is not set');
  }
  instance = new Telegraf<BotContext>(env.BOT_TOKEN);
  attachMiddlewares(instance);
  logger.info('Telegraf bot initialised');
  return instance;
}

export async function startBot(): Promise<void> {
  const bot = getBot();
  await bot.launch({
    dropPendingUpdates: true,
    allowedUpdates: [
      'message',
      'edited_message',
      'callback_query',
      'new_chat_members',
      'left_chat_member',
      'chat_member',
    ],
  } as any);

  // Enable graceful stop
  const stop = (sig: string) => {
    logger.info({ sig }, 'received signal, stopping bot');
    bot.stop(sig);
  };
  process.once('SIGINT', () => stop('SIGINT'));
  process.once('SIGTERM', () => stop('SIGTERM'));

  const me = await bot.telegram.getMe();
  logger.info({ username: me.username, id: me.id }, 'bot is up');
}
