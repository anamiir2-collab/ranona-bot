import { Context } from 'telegraf';
import { findMatchingFilter } from '../database/filters.js';

/**
 * Word Filter — checks the message text against the chat's banned words.
 * Returns the matched filter row, or null.
 */
export async function detectWordFilter(
  ctx: Context,
  text: string,
): Promise<{ word: string; action: string } | null> {
  if (!ctx.chat || ctx.chat.type === 'private') return null;
  const filter = await findMatchingFilter(ctx.chat.id, text);
  if (!filter) return null;
  return { word: filter.word, action: filter.action };
}
