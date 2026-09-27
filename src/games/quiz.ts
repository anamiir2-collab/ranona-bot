import { Context, Markup } from 'telegraf';
import { createGameRecord, finishGame, awardPoints, POINTS } from './gameManager.js';
import { updateGame, getGameById, recordMove, getRandomQuestion } from '../database/games.js';
import { upsertUser, incrementStat } from '../database/users.js';
import { logger } from '../utils/logger.js';

interface QuizState {
  questionId: string;
  question: string;
  options: string[];
  correctAnswer: string;
  points: number;
  answeredUsers: Set<number>;
  endedAt: number;
}

const SESSIONS = new Map<string, QuizState>();

const QUIZ_TIMEOUT_MS = 30_000;

export async function handleQuiz(ctx: Context): Promise<void> {
  if (!ctx.chat || ctx.chat.type === 'private') {
    await ctx.reply('Quiz متاح في الجروبات فقط.');
    return;
  }
  if (!ctx.from) return;
  const q = await getRandomQuestion();
  if (!q) {
    await ctx.reply('لا توجد أسئلة متاحة. أضف أسئلة عبر Supabase.');
    return;
  }
  const { game } = await createGameRecord(
    ctx.chat.id,
    ctx.chat.title || 'Group',
    ctx.chat.type,
    'quiz',
    ctx.from.id,
  );
  if (!game) {
    await ctx.reply('تعذر بدء المسابقة.');
    return;
  }
  await updateGame(game.id, { status: 'active' });
  const options = q.options || [];
  const session: QuizState = {
    questionId: q.id,
    question: q.question,
    options,
    correctAnswer: q.correct_answer,
    points: q.points,
    answeredUsers: new Set(),
    endedAt: Date.now() + QUIZ_TIMEOUT_MS,
  };
  SESSIONS.set(game.id, session);

  const buttons = options.map((opt, i) => [
    Markup.button.callback(opt, `quiz_ans:${game.id}:${i}`),
  ]);
  await ctx.reply(`Ranona Quiz\n\n${q.question}\n\nلديك 30 ثانية.`, Markup.inlineKeyboard(buttons));

  setTimeout(async () => {
    const s = SESSIONS.get(game.id);
    if (!s) return;
    await ctx.reply(`⏰ انتهى الوقت.\nالإجابة الصحيحة: ${s.correctAnswer}`).catch(() => undefined);
    SESSIONS.delete(game.id);
    const g = await getGameById(game.id);
    if (g) await finishGame(g, null, null);
  }, QUIZ_TIMEOUT_MS);
}

export async function onQuizAnswer(ctx: Context): Promise<void> {
  const data = (ctx.callbackQuery as any)?.data as string;
  const [, gameId, idxStr] = data.split(':');
  const idx = parseInt(idxStr, 10);
  if (!ctx.from) return;
  const session = SESSIONS.get(gameId);
  if (!session) {
    await ctx.answerCbQuery('انتهت المسابقة.');
    return;
  }
  if (session.answeredUsers.has(ctx.from.id)) {
    await ctx.answerCbQuery('لقد أجبت بالفعل.');
    return;
  }
  session.answeredUsers.add(ctx.from.id);
  await upsertUser({
    telegram_id: ctx.from.id,
    username: ctx.from.username ?? null,
    first_name: ctx.from.first_name ?? null,
    last_name: ctx.from.last_name ?? null,
  });
  await recordMove({
    game_id: gameId,
    telegram_user_id: ctx.from.id,
    move: { answer_index: idx, answer: session.options[idx] },
  });
  const chosen = session.options[idx];
  const isCorrect = chosen === session.correctAnswer;
  await ctx.answerCbQuery(isCorrect ? '✓ صحيح!' : '✗ خطأ');
  if (isCorrect) {
    await awardPoints(ctx.from.id, POINTS.CORRECT_ANSWER, 'correct_answers');
    await ctx.reply(`✓ #${ctx.from.id} — صحيح (+${POINTS.CORRECT_ANSWER})`);
  } else {
    await incrementStat(ctx.from.id, 'wrong_answers');
  }
}
