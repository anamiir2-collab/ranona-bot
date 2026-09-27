import { Context } from 'telegraf';
import { supabase } from '../database/supabase.js';
import * as gamesDb from '../database/games.js';
import * as usersDb from '../database/users.js';
import { POINTS } from '../config/constants.js';
import { logger } from '../utils/logger.js';

export type GameType =
  | 'xo'
  | 'rps'
  | 'guess'
  | 'quiz'
  | 'puzzle'
  | 'scrambled'
  | 'typing'
  | 'daily';

/**
 * Make sure a group row exists for this chat before creating a game.
 */
export async function ensureGroup(chatId: number, title: string, type: string) {
  const { upsertGroup } = await import('../database/groups.js');
  return upsertGroup({ telegram_chat_id: chatId, title, type });
}

/**
 * Award points to a user, incrementing the relevant stats atomically-ish.
 */
export async function awardPoints(
  telegram_user_id: number,
  delta: number,
  stat?: 'games_won' | 'games_lost' | 'games_played' | 'correct_answers' | 'wrong_answers',
): Promise<void> {
  const ok = await usersDb.addPoints(telegram_user_id, delta);
  if (!ok) return;
  if (stat) {
    await usersDb.incrementStat(telegram_user_id, stat);
  }
}

export async function finishGame(
  game: gamesDb.GameRow,
  winnerId: number | null,
  loserId?: number | null,
): Promise<void> {
  await gamesDb.updateGame(game.id, {
    status: 'finished',
    winner_id: winnerId,
    finished_at: new Date().toISOString(),
  });
  if (winnerId) {
    await awardPoints(winnerId, POINTS.WIN, 'games_won');
  }
  if (loserId) {
    await awardPoints(loserId, POINTS.LOSE, 'games_lost');
  }
}

export async function createGameRecord(
  chatId: number,
  chatTitle: string,
  chatType: string,
  gameType: GameType,
  createdBy: number,
  metadata?: Record<string, unknown>,
): Promise<{ group: any; game: gamesDb.GameRow | null }> {
  const group = await ensureGroup(chatId, chatTitle, chatType);
  if (!group) return { group: null, game: null };
  const game = await gamesDb.createGame({
    group_id: group.id,
    telegram_chat_id: chatId,
    game_type: gameType,
    created_by: createdBy,
    metadata,
  });
  return { group, game };
}

export { POINTS };
