import { Context } from 'telegraf';
import { gamesMenuKeyboard } from '../bot/keyboards.js';

export async function handleGamesCommand(ctx: Context): Promise<void> {
  await ctx.reply('Games — اختر لعبة:', gamesMenuKeyboard());
}
