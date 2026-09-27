import { Context, Telegraf } from 'telegraf';
import { logger } from '../utils/logger.js';
import { RATE_LIMIT } from '../config/constants.js';

/**
 * Skip messages from the bot itself and other bots.
 */
export function ignoreBots<T extends Context>(ctx: T, next: () => Promise<void>): Promise<void> {
  if (ctx.from?.is_bot) return Promise.resolve();
  return next();
}

/**
 * Simple per-user rate limiter for commands.
 */
const lastHit = new Map<string, { ts: number; n: number }>();

export function rateLimit<T extends Context>(max = RATE_LIMIT.MAX_REQUESTS, windowMs = RATE_LIMIT.WINDOW_MS) {
  return async (ctx: T, next: () => Promise<void>): Promise<void> => {
    if (!ctx.from) return next();
    const key = `${ctx.from.id}:${(ctx as any).message?.text ?? ''}`;
    const now = Date.now();
    const entry = lastHit.get(key);
    if (!entry || now - entry.ts > windowMs) {
      lastHit.set(key, { ts: now, n: 1 });
      return next();
    }
    entry.n += 1;
    if (entry.n > max) {
      logger.warn({ user_id: ctx.from.id }, 'rate limit exceeded');
      try {
        await ctx.reply('⏳ الرجاء الانتظار قليلًا قبل إرسال أمر آخر.');
      } catch {
        // ignore
      }
      return;
    }
    return next();
  };
}

/**
 * Wrap an async handler with global error handling so a single error
 * never crashes the bot.
 */
export function safeHandler<T extends Context>(
  fn: (ctx: T) => Promise<void>,
): (ctx: T, next: () => Promise<void>) => Promise<void> {
  return async (ctx, _next) => {
    try {
      await fn(ctx);
    } catch (e) {
      logger.error({ err: e }, 'handler error');
      try {
        await ctx.reply('حدث خطأ غير متوقع. حاول مرة أخرى.');
      } catch {
        // ignore
      }
    }
  };
}

/**
 * Ensure the user row exists in DB before handling further logic.
 */
export function ensureUser<T extends Context>(
  fn: (ctx: T) => Promise<void>,
): (ctx: T) => Promise<void> {
  return async (ctx) => {
    if (!ctx.from) return;
    const { upsertUser } = await import('../database/users.js');
    await upsertUser({
      telegram_id: ctx.from.id,
      username: ctx.from.username ?? null,
      first_name: ctx.from.first_name ?? null,
      last_name: ctx.from.last_name ?? null,
    });
    await fn(ctx);
  };
}

export function attachMiddlewares(bot: Telegraf) {
  bot.use(ignoreBots);
  bot.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    if (ctx.message && 'text' in ctx.message) {
      logger.debug({ text: ctx.message.text, ms }, 'msg');
    }
  });
}
