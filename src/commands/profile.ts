import { Context } from 'telegraf';
import { getUserByTelegramId, upsertUser } from '../database/users.js';
import { getUserRank } from '../database/statistics.js';
import { userDisplayName } from '../utils/formatters.js';

export async function handleProfile(ctx: Context, edit = false): Promise<void> {
  if (!ctx.from) return;
  await upsertUser({
    telegram_id: ctx.from.id,
    username: ctx.from.username ?? null,
    first_name: ctx.from.first_name ?? null,
    last_name: ctx.from.last_name ?? null,
  });
  const user = await getUserByTelegramId(ctx.from.id);
  if (!user) {
    await ctx.reply('تعذر العثور على ملفك. حاول /start أولاً.');
    return;
  }
  const chatId = ctx.chat && ctx.chat.type !== 'private' ? ctx.chat.id : undefined;
  const rank = await getUserRank(user.telegram_id, chatId);

  const lines = [
    `Profile — ${userDisplayName(ctx.from)}`,
    '',
    `Points: ${user.points}`,
    `Games Played: ${user.games_played}`,
    `Wins: ${user.games_won}`,
    `Losses: ${user.games_lost}`,
    `Correct Answers: ${user.correct_answers}`,
    `Wrong Answers: ${user.wrong_answers}`,
    `Win Streak: ${user.streak}`,
    `Rank: ${rank ? '#' + rank : 'غير متاح'}`,
  ].join('\n');

  if (edit && ctx.callbackQuery) {
    await ctx.editMessageText(lines, {
      reply_markup: { inline_keyboard: [[{ text: '« Back', callback_data: 'pm_back' }]] },
    });
  } else {
    await ctx.reply(lines);
  }
}
