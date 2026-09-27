import { Context } from 'telegraf';

const LINK_REGEX = /(https?:\/\/[^\s]+|t\.me\/[^\s]+|www\.[^\s]+)/i;

export function containsLink(ctx: Context): boolean {
  const text = (ctx.message as any)?.text || (ctx.message as any)?.caption;
  if (!text) return false;
  return LINK_REGEX.test(text);
}
