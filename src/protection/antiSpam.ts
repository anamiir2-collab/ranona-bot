import { Context } from 'telegraf';

/**
 * Detect repeated messages within a short window.
 */
const recentMessages = new Map<string, string[]>();
const WINDOW = 10_000;
const MAX_REPEAT = 3;

export async function detectSpam(ctx: Context): Promise<boolean> {
  if (!ctx.from || !ctx.chat || ctx.chat.type === 'private') return false;
  const text = (ctx.message as any)?.text || (ctx.message as any)?.caption;
  if (!text) return false;
  const key = `${ctx.chat.id}:${ctx.from.id}`;
  const arr = recentMessages.get(key) || [];
  const now = Date.now();
  const recent = arr.filter((t) => t.includes(text) && now - parseInt(t.split('|')[0]) < WINDOW);
  if (recent.length >= MAX_REPEAT) {
    recentMessages.set(key, [`${now}|${text}`]);
    return true;
  }
  arr.push(`${now}|${text}`);
  recentMessages.set(key, arr.slice(-20));
  return false;
}

/**
 * Periodically clean up old entries.
 */
setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of recentMessages.entries()) {
    const filtered = arr.filter((t) => now - parseInt(t.split('|')[0]) < WINDOW);
    if (filtered.length === 0) recentMessages.delete(k);
    else recentMessages.set(k, filtered);
  }
}, 60_000);
