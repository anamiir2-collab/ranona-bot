import { Context, Markup } from 'telegraf';
import { createGameRecord, finishGame } from './gameManager.js';
import { addPlayer, getGameById, listPlayers, recordMove, updateGame } from '../database/games.js';
import { writeLog } from '../database/logs.js';
import { logger } from '../utils/logger.js';

interface XoState {
  board: (string | null)[]; // 9 cells
  players: { X: number | null; O: number | null };
  turn: 'X' | 'O';
  moves: number;
}

const STATES = new Map<string, XoState>(); // in-memory for fast clicks

export async function handleXo(ctx: Context): Promise<void> {
  if (!ctx.chat || ctx.chat.type === 'private') {
    await ctx.reply('XO متاح في الجروبات فقط.');
    return;
  }
  if (!ctx.from) return;
  const { game } = await createGameRecord(
    ctx.chat.id,
    ctx.chat.title || 'Group',
    ctx.chat.type,
    'xo',
    ctx.from.id,
    { board: Array(9).fill(null) },
  );
  if (!game) {
    await ctx.reply('تعذر بدء اللعبة.');
    return;
  }
  STATES.set(game.id, {
    board: Array(9).fill(null),
    players: { X: ctx.from.id, O: null },
    turn: 'X',
    moves: 0,
  });

  await addPlayer({ game_id: game.id, telegram_user_id: ctx.from.id, symbol: 'X' });
  await writeLog({
    group_id: game.group_id,
    telegram_chat_id: ctx.chat.id,
    action: 'GAME_START',
    performed_by: ctx.from.id,
    metadata: { game_type: 'xo', game_id: game.id },
  });

  await ctx.reply(
    [
      'Ranona XO',
      '',
      `Player 1 (X): @${ctx.from.username || ctx.from.first_name}`,
      'بانتظار لاعب ثانٍ...',
    ].join('\n'),
    Markup.inlineKeyboard([[Markup.button.callback('Join Game', `xo_join:${game.id}`)]]),
  );
}

export async function onXoJoin(ctx: Context): Promise<void> {
  const data = (ctx.callbackQuery as any)?.data as string;
  const id = data.split(':')[1];
  if (!ctx.from) return;
  const state = STATES.get(id);
  if (!state) {
    await ctx.answerCbQuery('اللعبة غير موجودة أو انتهت.');
    return;
  }
  if (state.players.X === ctx.from.id) {
    await ctx.answerCbQuery('أنت بالفعل اللاعب X.');
    return;
  }
  if (state.players.O) {
    await ctx.answerCbQuery('اللعبة ممتلئة.');
    return;
  }
  state.players.O = ctx.from.id;
  await addPlayer({ game_id: id, telegram_user_id: ctx.from.id, symbol: 'O' });
  await updateGame(id, { status: 'active' });
  await ctx.answerCbQuery('تم الانضمام! تبدأ اللعبة.');
  await renderBoard(ctx, id);
}

async function renderBoard(ctx: Context, gameId: string): Promise<void> {
  const state = STATES.get(gameId);
  if (!state) return;
  const symbols = state.board.map((c) => (c === 'X' ? '❌' : c === 'O' ? '⭕' : '⬜'));
  const buttons = [];
  for (let i = 0; i < 9; i += 3) {
    buttons.push([
      Markup.button.callback(symbols[i], `xo_move:${gameId}:${i}`),
      Markup.button.callback(symbols[i + 1], `xo_move:${gameId}:${i + 1}`),
      Markup.button.callback(symbols[i + 2], `xo_move:${gameId}:${i + 2}`),
    ]);
  }
  const turnPlayer = state.turn === 'X' ? state.players.X : state.players.O;
  const text = `Ranona XO\nالدور: ${state.turn}${turnPlayer ? ` (#${turnPlayer})` : ''}`;
  try {
    await ctx.editMessageText(text, Markup.inlineKeyboard(buttons));
  } catch {
    await ctx.reply(text, Markup.inlineKeyboard(buttons));
  }
}

export async function onXoMove(ctx: Context): Promise<void> {
  const data = (ctx.callbackQuery as any)?.data as string;
  const [, gameId, cellStr] = data.split(':');
  const cell = parseInt(cellStr, 10);
  if (!ctx.from) return;
  const state = STATES.get(gameId);
  if (!state) {
    await ctx.answerCbQuery('اللعبة انتهت.');
    return;
  }
  const expectedId = state.turn === 'X' ? state.players.X : state.players.O;
  if (ctx.from.id !== expectedId) {
    await ctx.answerCbQuery('ليس دورك.');
    return;
  }
  if (state.board[cell] !== null) {
    await ctx.answerCbQuery('هذه الخانة محجوزة.');
    return;
  }
  state.board[cell] = state.turn;
  state.moves += 1;
  await recordMove({
    game_id: gameId,
    telegram_user_id: ctx.from.id,
    move: { cell, symbol: state.turn },
  });

  const winner = checkWinner(state.board);
  if (winner) {
    const winId = winner === 'X' ? state.players.X : state.players.O;
    const loseId = winner === 'X' ? state.players.O : state.players.X;
    const game = await getGameById(gameId);
    if (game) await finishGame(game, winId || null, loseId || null);
    STATES.delete(gameId);
    await ctx.answerCbQuery('انتهت اللعبة!');
    await ctx.editMessageText(`Ranona XO\n🏆 الفائز: ${winId ? '#' + winId : 'غير معروف'}`);
    return;
  }
  if (state.moves === 9) {
    const game = await getGameById(gameId);
    if (game) await finishGame(game, null, null);
    STATES.delete(gameId);
    await ctx.answerCbQuery('تعادل!');
    await ctx.editMessageText('Ranona XO\n🤝 تعادل!');
    return;
  }
  state.turn = state.turn === 'X' ? 'O' : 'X';
  await ctx.answerCbQuery('تم');
  await renderBoard(ctx, gameId);
}

function checkWinner(board: (string | null)[]): string | null {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a]!;
  }
  return null;
}
