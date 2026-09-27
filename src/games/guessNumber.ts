import { Context } from 'telegraf';
import { createGameRecord, finishGame } from './gameManager.js';
import { recordMove, updateGame, getGameById } from '../database/games.js';
import { randomInt } from 'crypto';

interface GuessState {
  target: number;
  attempts: number;
  maxAttempts: number;
  finished: boolean;
}

const SESSIONS = new Map<string, GuessState>();

export async function handleGuess(ctx: Context): Promise<void> {
  if (!ctx.chat || ctx.chat.type === 'private') {
    await ctx.reply('Guess Number متاح في الجروبات فقط.');
    return;
  }
  if (!ctx.from) return;
  const { game } = await createGameRecord(
    ctx.chat.id,
    ctx.chat.title || 'Group',
    ctx.chat.type,
    'guess',
    ctx.from.id,
  );
  if (!game) {
    await ctx.reply('تعذر بدء اللعبة.');
    return;
  }
  const target = randomInt(1, 101);
  SESSIONS.set(game.id, { target, attempts: 0, maxAttempts: 7, finished: false });
  await updateGame(game.id, { status: 'active' });

  await ctx.reply(
    [
      'Ranona Guess Number',
      '',
      'اخترت رقمًا بين 1 و 100.',
      `لديك ${7} محاولات.`,
      '',
      'أرسل رقمك في الشات (مثال: 42).',
    ].join('\n'),
  );
}

export async function onGuessMessage(ctx: Context): Promise<boolean> {
  if (!ctx.chat || ctx.chat.type === 'private') return false;
  if (!ctx.from) return false;
  const text = (ctx.message as any)?.text?.trim();
  if (!text || !/^\d+$/.test(text)) return false;

  // Find active guess session for this chat
  for (const [gameId, state] of SESSIONS.entries()) {
    if (state.finished) continue;
    const game = await getGameById(gameId);
    if (!game || game.telegram_chat_id !== ctx.chat.id) continue;

    state.attempts += 1;
    const guess = parseInt(text, 10);
    await recordMove({
      game_id: gameId,
      telegram_user_id: ctx.from.id,
      move: { guess },
    });

    if (guess === state.target) {
      state.finished = true;
      await finishGame(game, ctx.from.id, null);
      SESSIONS.delete(gameId);
      await ctx.reply(`🎉 صحيح! ${guess}\nالفائز: #${ctx.from.id}\nالمحاولات: ${state.attempts}`);
      return true;
    }
    if (state.attempts >= state.maxAttempts) {
      state.finished = true;
      await finishGame(game, null, null);
      SESSIONS.delete(gameId);
      await ctx.reply(`❌ انتهت المحاولات. الرقم الصحيح كان: ${state.target}`);
      return true;
    }
    await ctx.reply(
      `${guess > state.target ? '🔻 أصغر' : '🔺 أكبر'}\nالمحاولات المتبقية: ${
        state.maxAttempts - state.attempts
      }`,
    );
    return true;
  }
  return false;
}
