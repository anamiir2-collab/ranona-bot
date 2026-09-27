import { Context } from 'telegraf';
import { getGroupByChatId } from '../database/groups.js';
import { recentLogs } from '../database/logs.js';
import { getUserByTelegramId, upsertUser } from '../database/users.js';
import { isGroupChat } from '../utils/helpers.js';

export async function handleStats(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  await upsertUser({
    telegram_id: ctx.from.id,
    username: ctx.from.username ?? null,
    first_name: ctx.from.first_name ?? null,
    last_name: ctx.from.last_name ?? null,
  });

  const user = await getUserByTelegramId(ctx.from.id);

  if (ctx.chat && isGroupChat(ctx.chat)) {
    const group = await getGroupByChatId(ctx.chat.id);
    if (!group) {
      await ctx.reply('الجروب غير مسجل. استخدم /start.');
      return;
    }
    const logs = await recentLogs(group.telegram_chat_id, 5);
    const lines = [
      `Stats — ${group.title}`,
      '',
      `Recent actions (${logs.length}):`,
      ...logs.map(
        (l) =>
          `• ${l.action} — by #${l.performed_by ?? '?'} → #${l.target_user ?? '?'}${
            l.reason ? ` (${l.reason})` : ''
          }`,
      ),
    ];
    await ctx.reply(lines.join('\n'));
    return;
  }

  if (!user) {
    await ctx.reply('لا يوجد ملف بعد. استخدم /start.');
    return;
  }
  await ctx.reply(
    [
      `Stats — ${user.username || user.first_name || user.telegram_id}`,
      '',
      `Points: ${user.points}`,
      `Games: ${user.games_played}`,
      `Wins/Losses: ${user.games_won}/${user.games_lost}`,
      `Correct/Wrong: ${user.correct_answers}/${user.wrong_answers}`,
      `Streak: ${user.streak}`,
    ].join('\n'),
  );
}
