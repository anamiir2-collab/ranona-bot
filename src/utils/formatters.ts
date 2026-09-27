import { Markup } from 'telegraf';
import { InlineKeyboardButton } from 'telegraf/types';

/**
 * Build an inline keyboard from a 2D array of button definitions.
 */
export function buildKeyboard(
  rows: Array<Array<{ text: string; callback_data: string }>>,
) {
  return Markup.inlineKeyboard(rows as InlineKeyboardButton.CallbackButton[][]);
}

export function welcomeMessage(
  template: string,
  ctx: { name: string; username?: string; group: string; id: number },
): string {
  return template
    .replace(/{name}/g, ctx.name)
    .replace(/{username}/g, ctx.username || '')
    .replace(/{group}/g, ctx.group)
    .replace(/{id}/g, String(ctx.id));
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function truncate(text: string, max = 200): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

export function escapeMarkdownV2(text: string): string {
  // Escape Telegram MarkdownV2 special chars (only useful if parse_mode=MarkdownV2)
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

export function userDisplayName(u: {
  first_name?: string;
  last_name?: string;
  username?: string;
  id: number;
}): string {
  if (u.username) return `@${u.username}`;
  const parts = [u.first_name, u.last_name].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  return `User #${u.id}`;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
