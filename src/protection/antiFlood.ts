import { Context } from 'telegraf';

const counters = new Map<string, { ts: number; n: number }[]>();
const WINDOW_MS = 3_000;
const MAX = 5;

export function checkFlood(ctx: Context, threshold = MAX, windowMs = WINDOW_MS): boolean {
  if (!ctx.from || !ctx.chat || ctx.chat.type === 'private') return false;
  const key = `${ctx.chat.id}:${ctx.from.id}`;
  const now = Date.now();
  let arr = counters.get(key) || [];
  arr = arr.filter((e) => now - e.ts < windowMs);
  arr.push({ ts: now, n: 1 });
  counters.set(key, arr.slice(-20));
  return arr.length > threshold;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of counters.entries()) {
    const filtered = arr.filter((e) => now - e.ts < WINDOW_MS);
    if (filtered.length === 0) counters.delete(k);
    else counters.set(k, filtered);
  }
}, 60_000);
