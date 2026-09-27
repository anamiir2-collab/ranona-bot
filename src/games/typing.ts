import { Context } from 'telegraf';
import { createGameRecord, finishGame, POINTS } from './gameManager.js';
import { getGameById, recordMove, updateGame } from '../database/games.js';
import { upsertUser, addPoints, incrementStat } from '../database/users.js';

interface TypingSession {
  gameId: string;
  text: string;
  startedAt: number;
  ended: boolean;
  winner: number | null;
}

const SESSIONS = new Map<number, TypingSession[]>();

const TEXTS = [
  'الإصرار مفتاح النجاح',
  'العلم نور والجهل ظلام',
  'الصبر مرّ لكن ثمره حلو',
  'من جدّ وجد ومن زرع حصد',
  'اللغة العربية لغة غنية وكريمة',
];

export async function handleTyping(ctx: Context): Promise<void> {
  if (!ctx.chat || ctx.chat.type === 'private') {
    await ctx.reply('Typing Challenge متاح في الجروبات فقط.');
    return;
  }
  if (!ctx.from) return;
  const text = TEXTS[Math.floor(Math.random() * TEXTS.length)];
  const { game } = await createGameRecord(
    ctx.chat.id,
    ctx.chat.title || 'Group',
    ctx.chat.type,
    'typing',
    ctx.from.id,
    { text },
  );
  if (!game) {
    await ctx.reply('تعذر بدء التحدي.');
    return;
  }
  const session: TypingSession = {
    gameId: game.id,
    text,
    startedAt: Date.now(),
    ended: false,
    winner: null,
  };
  const arr = SESSIONS.get(ctx.chat.id) || [];
  arr.push(session);
  SESSIONS.set(ctx.chat.id, arr);
  await updateGame(game.id, { status: 'active' });
  await ctx.reply(
    [
      'Ranona Typing Challenge',
      '',
      'اكتب النص التالي بدقة:',
      '',
      `> ${text}`,
      '',
      'أول من يكتبه بالضبط يفوز (+10 نقاط).',
    ].join('\n'),
  );
}

export async function onTypingMessage(ctx: Context): Promise<boolean> {
  if (!ctx.chat || !ctx.from) return false;
  const arr = SESSIONS.get(ctx.chat.id);
  if (!arr || arr.length === 0) return false;
  const text = (ctx.message as any)?.text?.trim();
  if (!text) return false;
  let handled = false;
  for (const session of arr) {
    if (session.ended) continue;
    const normalized = text.replace(/\s+/g, ' ').trim();
    const expected = session.text.replace(/\s+/g, ' ').trim();
    if (normalized === expected) {
      session.ended = true;
      session.winner = ctx.from.id;
      const reactionMs = Date.now() - session.startedAt;
      await upsertUser({
        telegram_id: ctx.from.id,
        username: ctx.from.username ?? null,
        first_name: ctx.from.first_name ?? null,
        last_name: ctx.from.last_name ?? null,
      });
      await addPoints(ctx.from.id, POINTS.WIN);
      await incrementStat(ctx.from.id, 'games_won');
      const game = await getGameById(session.gameId);
      if (game) await finishGame(game, ctx.from.id, null);
      await ctx.reply(
        `⌨️ #${ctx.from.id} — فاز! (+${POINTS.WIN} نقاط)\nReaction Time: ${(reactionMs / 1000).toFixed(2)}s`,
      );
      handled = true;
      break;
    }
  }
  const filtered = (SESSIONS.get(ctx.chat.id) || []).filter((s) => !s.ended);
  SESSIONS.set(ctx.chat.id, filtered);
  return handled;
}
