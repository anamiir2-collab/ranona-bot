import { Context } from 'telegraf';
import { logger } from '../utils/logger.js';
import { RATE_LIMIT } from '../config/constants.js';

const hits = new Map<string, { ts: number; n: number }>();

/**
 * Generic in-memory rate limiter. Returns true if the request is allowed.
 */
export function allow(key: string, max = RATE_LIMIT.MAX_REQUESTS, windowMs = RATE_LIMIT.WINDOW_MS): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now - entry.ts > windowMs) {
    hits.set(key, { ts: now, n: 1 });
    return true;
  }
  entry.n += 1;
  if (entry.n > max) {
    logger.warn({ key }, 'rate limit exceeded');
    return false;
  }
  return true;
}

export function rateLimitCommand(max = RATE_LIMIT.MAX_REQUESTS, windowMs = RATE_LIMIT.WINDOW_MS) {
  return async (ctx: Context, next: () => Promise<void>): Promise<void> => {
    if (!ctx.from) return next();
    const cmd = (ctx.message as any)?.text?.split(/\s+/)[0] || 'unknown';
    const key = `cmd:${ctx.from.id}:${cmd}`;
    if (!allow(key, max, windowMs)) {
      await ctx.reply('⏳ بطء قليل... حاول ثانية.').catch(() => undefined);
      return;
    }
    return next();
  };
}
