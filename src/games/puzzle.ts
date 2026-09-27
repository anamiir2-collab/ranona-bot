import { Context } from 'telegraf';
import { createGameRecord, finishGame, POINTS } from './gameManager.js';
import { getRandomPuzzle, getGameById } from '../database/games.js';
import { upsertUser, addPoints, incrementStat } from '../database/users.js';

interface PuzzleSession {
  gameId: string;
  answer: string;
  points: number;
  ended: boolean;
  winners: Set<number>;
}

const SESSIONS = new Map<number, PuzzleSession[]>(); // chatId -> sessions

export async function handlePuzzle(ctx: Context): Promise<void> {
  if (!ctx.chat || ctx.chat.type === 'private') {
    await ctx.reply('Puzzle متاح في الجروبات فقط.');
    return;
  }
  if (!ctx.from) return;
  const p = await getRandomPuzzle();
  if (!p) {
    await ctx.reply('لا توجد ألغاز متاحة. أضف ألغازًا عبر Supabase.');
    return;
  }
  const { game } = await createGameRecord(
    ctx.chat.id,
    ctx.chat.title || 'Group',
    ctx.chat.type,
    'puzzle',
    ctx.from.id,
  );
  if (!game) {
    await ctx.reply('تعذر بدء اللغز.');
    return;
  }
  const session: PuzzleSession = {
    gameId: game.id,
    answer: p.answer,
    points: p.points,
    ended: false,
    winners: new Set(),
  };
  const arr = SESSIONS.get(ctx.chat.id) || [];
  arr.push(session);
  SESSIONS.set(ctx.chat.id, arr);

  await ctx.reply(`🧩 Ranona Puzzle\n\n${p.question}\n\nأول إجابة صحيحة = +${p.points} نقاط.`);
}

export async function onPuzzleMessage(ctx: Context): Promise<boolean> {
  if (!ctx.chat || !ctx.from) return false;
  const arr = SESSIONS.get(ctx.chat.id);
  if (!arr || arr.length === 0) return false;
  const text = (ctx.message as any)?.text?.trim();
  if (!text) return false;
  let handled = false;
  for (const session of arr) {
    if (session.ended) continue;
    const normalized = text.replace(/[ًَُِّْ]/g, '').trim().toLowerCase();
    const expected = session.answer.replace(/[ًَُِّْ]/g, '').trim().toLowerCase();
    if (normalized === expected) {
      if (session.winners.has(ctx.from.id)) continue;
      session.winners.add(ctx.from.id);
      await upsertUser({
        telegram_id: ctx.from.id,
        username: ctx.from.username ?? null,
        first_name: ctx.from.first_name ?? null,
        last_name: ctx.from.last_name ?? null,
      });
      await addPoints(ctx.from.id, session.points);
      await incrementStat(ctx.from.id, 'correct_answers');
      session.ended = true;
      const game = await getGameById(session.gameId);
      if (game) await finishGame(game, ctx.from.id, null);
      await ctx.reply(`🎉 #${ctx.from.id} — إجابة صحيحة! +${session.points} نقاط.`);
      handled = true;
      break;
    }
  }
  // cleanup
  const filtered = (SESSIONS.get(ctx.chat.id) || []).filter((s) => !s.ended);
  SESSIONS.set(ctx.chat.id, filtered);
  return handled;
}
