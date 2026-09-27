import { supabase } from './supabase.js';
import { logger } from '../utils/logger.js';
import { todayDateString, pickRandom } from '../utils/helpers.js';

// ============== GAMES ==============
export interface GameRow {
  id: string;
  group_id: string;
  telegram_chat_id: number;
  game_type: string;
  created_by: number;
  status: string;
  winner_id: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  finished_at: string | null;
}

export interface GamePlayerRow {
  id: string;
  game_id: string;
  telegram_user_id: number;
  symbol: string | null;
  score: number;
  joined_at: string;
}

export interface GameMoveRow {
  id: string;
  game_id: string;
  telegram_user_id: number;
  move: Record<string, unknown>;
  created_at: string;
}

export async function createGame(input: {
  group_id: string;
  telegram_chat_id: number;
  game_type: string;
  created_by: number;
  metadata?: Record<string, unknown>;
}): Promise<GameRow | null> {
  const { data, error } = await supabase()
    .from('games')
    .insert({
      group_id: input.group_id,
      telegram_chat_id: input.telegram_chat_id,
      game_type: input.game_type,
      created_by: input.created_by,
      status: 'waiting',
      metadata: input.metadata ?? {},
    })
    .select()
    .single();
  if (error) {
    logger.error({ err: error }, 'createGame failed');
    return null;
  }
  return data as GameRow;
}

export async function getGameById(id: string): Promise<GameRow | null> {
  const { data, error } = await supabase().from('games').select('*').eq('id', id).maybeSingle();
  if (error) {
    logger.error({ err: error }, 'getGameById failed');
    return null;
  }
  return (data as GameRow) ?? null;
}

export async function updateGame(
  id: string,
  patch: Partial<GameRow>,
): Promise<GameRow | null> {
  const { data, error } = await supabase()
    .from('games')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    logger.error({ err: error }, 'updateGame failed');
    return null;
  }
  return data as GameRow;
}

export async function addPlayer(input: {
  game_id: string;
  telegram_user_id: number;
  symbol?: string | null;
}): Promise<GamePlayerRow | null> {
  const { data, error } = await supabase()
    .from('game_players')
    .upsert(
      {
        game_id: input.game_id,
        telegram_user_id: input.telegram_user_id,
        symbol: input.symbol ?? null,
      },
      { onConflict: 'game_id,telegram_user_id' },
    )
    .select()
    .single();
  if (error) {
    logger.error({ err: error }, 'addPlayer failed');
    return null;
  }
  return data as GamePlayerRow;
}

export async function listPlayers(game_id: string): Promise<GamePlayerRow[]> {
  const { data, error } = await supabase()
    .from('game_players')
    .select('*')
    .eq('game_id', game_id)
    .order('joined_at', { ascending: true });
  if (error) {
    logger.error({ err: error }, 'listPlayers failed');
    return [];
  }
  return (data as GamePlayerRow[]) ?? [];
}

export async function recordMove(input: {
  game_id: string;
  telegram_user_id: number;
  move: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase().from('game_moves').insert({
    game_id: input.game_id,
    telegram_user_id: input.telegram_user_id,
    move: input.move,
  });
  if (error) logger.error({ err: error }, 'recordMove failed');
}

export async function listMoves(game_id: string): Promise<GameMoveRow[]> {
  const { data, error } = await supabase()
    .from('game_moves')
    .select('*')
    .eq('game_id', game_id)
    .order('created_at', { ascending: true });
  if (error) {
    logger.error({ err: error }, 'listMoves failed');
    return [];
  }
  return (data as GameMoveRow[]) ?? [];
}

export async function findActiveGameByChat(
  telegram_chat_id: number,
  game_type?: string,
): Promise<GameRow | null> {
  let q = supabase()
    .from('games')
    .select('*')
    .eq('telegram_chat_id', telegram_chat_id)
    .in('status', ['waiting', 'active'])
    .order('created_at', { ascending: false })
    .limit(1);
  if (game_type) q = q.eq('game_type', game_type);
  const { data, error } = await q.maybeSingle();
  if (error) {
    logger.error({ err: error }, 'findActiveGameByChat failed');
    return null;
  }
  return (data as GameRow) ?? null;
}

// ============== QUESTIONS ==============
export interface QuestionRow {
  id: string;
  question: string;
  category: string;
  difficulty: string;
  options: string[] | null;
  correct_answer: string;
  points: number;
  language: string;
}

export async function getRandomQuestion(category?: string): Promise<QuestionRow | null> {
  let q = supabase().from('questions').select('*');
  if (category) q = q.eq('category', category);
  const { data, error } = await q;
  if (error) {
    logger.error({ err: error }, 'getRandomQuestion failed');
    return null;
  }
  if (!data || data.length === 0) return null;
  return pickRandom(data as QuestionRow[]);
}

export async function getQuestionById(id: string): Promise<QuestionRow | null> {
  const { data, error } = await supabase()
    .from('questions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    logger.error({ err: error }, 'getQuestionById failed');
    return null;
  }
  return (data as QuestionRow) ?? null;
}

// ============== PUZZLES ==============
export interface PuzzleRow {
  id: string;
  question: string;
  answer: string;
  difficulty: string;
  points: number;
  language: string;
}

export async function getRandomPuzzle(): Promise<PuzzleRow | null> {
  const { data, error } = await supabase().from('puzzles').select('*');
  if (error) {
    logger.error({ err: error }, 'getRandomPuzzle failed');
    return null;
  }
  if (!data || data.length === 0) return null;
  return pickRandom(data as PuzzleRow[]);
}

// ============== DAILY CHALLENGE ==============
export interface DailyChallengeRow {
  id: string;
  challenge_date: string;
  challenge_type: string;
  reference_id: string | null;
  question: string;
  answer: string;
  points: number;
}

export async function getTodaysChallenge(): Promise<DailyChallengeRow | null> {
  const today = todayDateString();
  const { data, error } = await supabase()
    .from('daily_challenges')
    .select('*')
    .eq('challenge_date', today)
    .maybeSingle();
  if (error) {
    logger.error({ err: error }, 'getTodaysChallenge failed');
    return null;
  }
  if (data) return data as DailyChallengeRow;

  // Generate a new one from puzzles pool
  const puzzle = await getRandomPuzzle();
  if (!puzzle) return null;
  const { data: created, error: insErr } = await supabase()
    .from('daily_challenges')
    .upsert(
      {
        challenge_date: today,
        challenge_type: 'puzzle',
        reference_id: puzzle.id,
        question: puzzle.question,
        answer: puzzle.answer,
        points: puzzle.points,
      },
      { onConflict: 'challenge_date' },
    )
    .select()
    .single();
  if (insErr) {
    logger.error({ err: insErr }, 'createTodaysChallenge failed');
    return null;
  }
  return created as DailyChallengeRow;
}

export async function hasUserParticipatedToday(telegram_user_id: number): Promise<boolean> {
  const today = todayDateString();
  const { count, error } = await supabase()
    .from('daily_challenge_participations')
    .select('*', { count: 'exact', head: true })
    .eq('telegram_user_id', telegram_user_id)
    .gte('created_at', today);
  if (error) {
    logger.error({ err: error }, 'hasUserParticipatedToday failed');
    return false;
  }
  return (count || 0) > 0;
}

export async function recordDailyParticipation(input: {
  challenge_id: string;
  telegram_user_id: number;
  telegram_chat_id?: number;
  answer: string;
  is_correct: boolean;
  points_earned: number;
}): Promise<boolean> {
  const { error } = await supabase()
    .from('daily_challenge_participations')
    .upsert(
      {
        challenge_id: input.challenge_id,
        telegram_user_id: input.telegram_user_id,
        telegram_chat_id: input.telegram_chat_id ?? null,
        answer: input.answer,
        is_correct: input.is_correct,
        points_earned: input.points_earned,
      },
      { onConflict: 'challenge_id,telegram_user_id' },
    );
  if (error) {
    logger.error({ err: error }, 'recordDailyParticipation failed');
    return false;
  }
  return true;
}
