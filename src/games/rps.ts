import { Context, Markup } from 'telegraf';
import { createGameRecord, finishGame } from './gameManager.js';
import { addPlayer, recordMove, getGameById } from '../database/games.js';

interface RpsState {
  players: number[];
  choices: Record<number, 'rock' | 'paper' | 'scissors'>;
  messageId?: number;
}

const SESSIONS = new Map<string, RpsState>();

export async function handleRps(ctx: Context): Promise<void> {
  if (!ctx.chat || ctx.chat.type === 'private') {
    await ctx.reply('RPS متاح في الجروبات فقط.');
    return;
  }
  if (!ctx.from) return;
  const { game } = await createGameRecord(
    ctx.chat.id,
    ctx.chat.title || 'Group',
    ctx.chat.type,
    'rps',
    ctx.from.id,
  );
  if (!game) {
    await ctx.reply('تعذر بدء اللعبة.');
    return;
  }
  SESSIONS.set(game.id, { players: [ctx.from.id], choices: {} });
  await addPlayer({ game_id: game.id, telegram_user_id: ctx.from.id });
  await ctx.reply(
    [
      'Ranona RPS — Rock Paper Scissors',
      '',
      `Player 1: @${ctx.from.username || ctx.from.first_name}`,
      'بانتظار لاعب ثانٍ...',
    ].join('\n'),
    Markup.inlineKeyboard([[Markup.button.callback('Join Game', `rps_join:${game.id}`)]]),
  );
}

export async function onRpsJoin(ctx: Context): Promise<void> {
  const data = (ctx.callbackQuery as any)?.data as string;
  const gameId = data.split(':')[1];
  if (!ctx.from) return;
  const session = SESSIONS.get(gameId);
  if (!session) {
    await ctx.answerCbQuery('اللعبة انتهت.');
    return;
  }
  if (session.players.includes(ctx.from.id)) {
    await ctx.answerCbQuery('أنت بالفعل في اللعبة.');
    return;
  }
  if (session.players.length >= 2) {
    await ctx.answerCbQuery('اللعبة ممتلئة.');
    return;
  }
  session.players.push(ctx.from.id);
  await addPlayer({ game_id: gameId, telegram_user_id: ctx.from.id });
  await ctx.answerCbQuery('تم الانضمام. اختر سلاحك.');
  await askChoice(ctx, gameId);
}

async function askChoice(ctx: Context, gameId: string): Promise<void> {
  const text = 'اختر سلاحك:';
  const kb = Markup.inlineKeyboard([
    [
      Markup.button.callback('🪨 Rock', `rps_pick:${gameId}:rock`),
      Markup.button.callback('📄 Paper', `rps_pick:${gameId}:paper`),
      Markup.button.callback('✂ Scissors', `rps_pick:${gameId}:scissors`),
    ],
  ]);
  try {
    await ctx.editMessageText(text, kb);
  } catch {
    await ctx.reply(text, kb);
  }
}

export async function onRpsPick(ctx: Context): Promise<void> {
  const data = (ctx.callbackQuery as any)?.data as string;
  const [, gameId, choice] = data.split(':');
  if (!ctx.from) return;
  const session = SESSIONS.get(gameId);
  if (!session) {
    await ctx.answerCbQuery('اللعبة انتهت.');
    return;
  }
  if (!session.players.includes(ctx.from.id)) {
    await ctx.answerCbQuery('لست مشاركًا في هذه اللعبة.');
    return;
  }
  if (session.choices[ctx.from.id]) {
    await ctx.answerCbQuery('لقد اخترت بالفعل.');
    return;
  }
  session.choices[ctx.from.id] = choice as any;
  await recordMove({
    game_id: gameId,
    telegram_user_id: ctx.from.id,
    move: { choice },
  });
  await ctx.answerCbQuery('تم تسجيل اختيارك.');
  if (Object.keys(session.choices).length === 2) {
    await resolve(ctx, gameId);
  }
}

async function resolve(ctx: Context, gameId: string): Promise<void> {
  const session = SESSIONS.get(gameId)!;
  const [a, b] = session.players;
  const ca = session.choices[a];
  const cb = session.choices[b];
  let winnerId: number | null = null;
  let loserId: number | null = null;
  if (ca === cb) {
    // draw
  } else if (
    (ca === 'rock' && cb === 'scissors') ||
    (ca === 'paper' && cb === 'rock') ||
    (ca === 'scissors' && cb === 'paper')
  ) {
    winnerId = a;
    loserId = b;
  } else {
    winnerId = b;
    loserId = a;
  }
  const game = await getGameById(gameId);
  if (game) await finishGame(game, winnerId, loserId);
  SESSIONS.delete(gameId);
  const lines = [
    'Ranona RPS',
    '',
    `Player 1: ${label(ca)}`,
    `Player 2: ${label(cb)}`,
    '',
    winnerId ? `🏆 الفائز: #${winnerId} (+10 نقاط)` : '🤝 تعادل',
  ];
  await ctx.editMessageText(lines.join('\n'));
}

function label(c: string): string {
  return c === 'rock' ? '🪨 Rock' : c === 'paper' ? '📄 Paper' : c === 'scissors' ? '✂ Scissors' : '?';
}
