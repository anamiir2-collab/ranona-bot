import { Context, Markup } from 'telegraf';
import { createGameRecord, finishGame, POINTS } from './gameManager.js';
import { getGameById, recordMove, updateGame } from '../database/games.js';
import { upsertUser, addPoints, incrementStat } from '../database/users.js';
import { shuffle } from '../utils/helpers.js';

interface ScrambledSession {
  gameId: string;
  original: string;
  ended: boolean;
  winners: Set<number>;
}

const SESSIONS = new Map<number, ScrambledSession[]>();

const WORDS = ['مرقان', 'مكتبة', 'تلفاز', 'حاسوب', 'مدرسة', 'تطبيق', 'برنامج', 'صفحة', 'كتاب', 'قلم'];

function scrambleArabic(word: string): string {
  const chars = word.split(' ');
  const out: string[] = [];
  chars.forEach((w) => {
    if (w.length > 1) {
      const shuffled = shuffle(w.split('')).join('');
      out.push(shuffled);
    } else {
      out.push(w);
    }
  });
  return out.join(' ');
}

export async function handleScrambled(ctx: Context): Promise<void> {
  if (!ctx.chat || ctx.chat.type === 'private') {
    await ctx.reply('Scrambled Words متاح في الجروبات فقط.');
    return;
  }
  if (!ctx.from) return;
  const original = WORDS[Math.floor(Math.random() * WORDS.length)];
  const scrambled = scrambleArabic(original);
  const { game } = await createGameRecord(
    ctx.chat.id,
    ctx.chat.title || 'Group',
    ctx.chat.type,
    'scrambled',
    ctx.from.id,
    { original },
  );
  if (!game) {
    await ctx.reply('تعذر بدء اللعبة.');
    return;
  }
  const session: ScrambledSession = { gameId: game.id, original, ended: false, winners: new Set() };
  const arr = SESSIONS.get(ctx.chat.id) || [];
  arr.push(session);
  SESSIONS.set(ctx.chat.id, arr);
  await updateGame(game.id, { status: 'active' });
  await ctx.reply(
    [
      'Ranona Scrambled Words',
      '',
      `الحروف المبعثرة: ${scrambled}`,
      '',
      'أعد ترتيب الحروف لإيجاد الكلمة الصحيحة.',
    ].join('\n'),
  );
}

export async function onScrambledMessage(ctx: Context): Promise<boolean> {
  if (!ctx.chat || !ctx.from) return false;
  const arr = SESSIONS.get(ctx.chat.id);
  if (!arr || arr.length === 0) return false;
  const text = (ctx.message as any)?.text?.trim();
  if (!text) return false;
  let handled = false;
  for (const session of arr) {
    if (session.ended) continue;
    const normalized = text.replace(/[ًَُِّْ]/g, '').trim().toLowerCase();
    const expected = session.original.replace(/[ًَُِّْ]/g, '').trim().toLowerCase();
    if (normalized === expected) {
      if (session.winners.has(ctx.from.id)) continue;
      session.winners.add(ctx.from.id);
      session.ended = true;
      await upsertUser({
        telegram_id: ctx.from.id,
        username: ctx.from.username ?? null,
        first_name: ctx.from.first_name ?? null,
        last_name: ctx.from.last_name ?? null,
      });
      await addPoints(ctx.from.id, POINTS.CORRECT_ANSWER);
      await incrementStat(ctx.from.id, 'correct_answers');
      const game = await getGameById(session.gameId);
      if (game) await finishGame(game, ctx.from.id, null);
      await ctx.reply(`🎉 #${ctx.from.id} — صحيح! الكلمة: ${session.original} (+${POINTS.CORRECT_ANSWER})`);
      handled = true;
      break;
    }
  }
  const filtered = (SESSIONS.get(ctx.chat.id) || []).filter((s) => !s.ended);
  SESSIONS.set(ctx.chat.id, filtered);
  return handled;
}
