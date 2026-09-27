import { Context } from 'telegraf';

export function isForwarded(ctx: Context): boolean {
  return Boolean((ctx.message as any)?.forward_date || (ctx.message as any)?.forward_from || (ctx.message as any)?.forward_from_chat);
}
