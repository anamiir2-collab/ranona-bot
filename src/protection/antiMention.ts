import { Context } from 'telegraf';

const MENTION_REGEX = /@[a-zA-Z0-9_]{3,}/g;
const MAX_MENTIONS = 5;

export function countMentions(ctx: Context): number {
  const text = (ctx.message as any)?.text || (ctx.message as any)?.caption;
  if (!text) return 0;
  return (text.match(MENTION_REGEX) || []).length;
}

export function isMentionSpam(ctx: Context): boolean {
  return countMentions(ctx) > MAX_MENTIONS;
}
