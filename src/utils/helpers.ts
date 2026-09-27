import { randomInt } from 'crypto';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function pickRandom<T>(arr: T[]): T {
  if (arr.length === 0) throw new Error('pickRandom: empty array');
  return arr[randomInt(arr.length)];
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function isPrivateChat(chat: { type: string }): boolean {
  return chat.type === 'private';
}

export function isGroupChat(chat: { type: string }): boolean {
  return chat.type === 'group' || chat.type === 'supergroup';
}

export function isAdminContext(from?: { id: number }): boolean {
  return !!from;
}

/** Parse a duration string like "10m" / "1h" / "30s" → seconds. */
export function parseDuration(input?: string): number | null {
  if (!input) return null;
  const m = input.match(/^(\d+)([smhd])?$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2] || 'm';
  const mult = { s: 1, m: 60, h: 3600, d: 86400 } as const;
  return n * mult[unit as keyof typeof mult];
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export function safeJsonParse<T>(input: unknown, fallback: T): T {
  if (typeof input === 'string') {
    try {
      return JSON.parse(input);
    } catch {
      return fallback;
    }
  }
  return (input as T) ?? fallback;
}

export function isTruish(v: unknown): boolean {
  return v === true || v === 1 || v === 'true' || v === '1' || v === 'on';
}
