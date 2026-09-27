import { Context } from 'telegraf';
import { getGlobalLeaderboard, getGroupLeaderboard } from '../database/statistics.js';
import { userDisplayName } from '../utils/formatters.js';
import { isGroupChat } from '../utils/helpers.js';

export async function handleRank(ctx: Context, edit = false): Promise<void> {
  const isGroup = ctx.chat && isGroupChat(ctx.chat);
  const rows = isGroup
    ? await getGroupLeaderboard(ctx.chat!.id, 10)
    : await getGlobalLeaderboard(10);

  if (rows.length === 0) {
    const empty = 'لا توجد بيانات كافية بعد. العب الألعاب لكسب النقاط!';
    if (edit && ctx.callbackQuery) {
      await ctx.editMessageText(empty, {
        reply_markup: { inline_keyboard: [[{ text: '« Back', callback_data: 'pm_back' }]] },
      });
    } else {
      await ctx.reply(empty);
    }
    return;
  }

  const lines: string[] = [`${isGroup ? 'Group' : 'Global'} Leaderboard — Ranona`, ''];
  rows.forEach((r: any, i: number) => {
    const name =
      r.username || r.first_name
        ? userDisplayName({ username: r.username, first_name: r.first_name, last_name: r.last_name, id: r.telegram_id })
        : `User #${r.telegram_id}`;
    lines.push(`${i + 1}. ${name} — ${r.points}`);
  });

  if (edit && ctx.callbackQuery) {
    await ctx.editMessageText(lines.join('\n'), {
      reply_markup: { inline_keyboard: [[{ text: '« Back', callback_data: 'pm_back' }]] },
    });
  } else {
    await ctx.reply(lines.join('\n'));
  }
}
