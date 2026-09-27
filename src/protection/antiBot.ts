import { Context } from 'telegraf';
import { logger } from '../utils/logger.js';

/**
 * Anti-Bot: detects messages from bot accounts. Telegram exposes `from.is_bot`.
 * We do NOT ban based on heuristics alone — only delete when admin has enabled.
 */
export function isFromBot(ctx: Context): boolean {
  return Boolean(ctx.from?.is_bot);
}

export async function handleBotMessage(ctx: Context): Promise<void> {
  // For now we only log. Banning bots blindly based on heuristics is forbidden
  // by the project spec. Admin can configure explicitly.
  logger.debug({ user_id: ctx.from?.id }, 'bot account detected');
}
