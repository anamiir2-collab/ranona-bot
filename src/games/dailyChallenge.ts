import { Context } from 'telegraf';
import {
  getTodaysChallenge,
  recordDailyParticipation,
  hasUserParticipatedToday,
} from '../database/games.js';
import { upsertUser, addPoints, incrementStat } from '../database/users.js';
import { POINTS } from '../config/constants.js';
import { logger } from '../utils/logger.js';

interface DailySession {
  challengeId: string;
  answer: string;
  points: number;
  ended: boolean;
}

const ACTIVE = new Map<number, DailySession>();

export async function handleDaily(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  await upsertUser({
    telegram_id: ctx.from.id,
    username: ctx.from.username ?? null,
    first_name: ctx.from.first_name ?? null,
    last_name: ctx.from.last_name ?? null,
  });

  if (await hasUserParticipatedToday(ctx.from.id)) {
    await ctx.reply('لقد شاركت في التحدي اليومي بالفعل. عُد غدًا!');
    return;
  }

  const challenge = await getTodaysChallenge();
  if (!challenge) {
    await ctx.reply('لا يوجد تحدي اليوم. حاول لاحقًا.');
    return;
  }

  const session: DailySession = {
    challengeId: challenge.id,
    answer: challenge.answer,
    points: challenge.points,
    ended: false,
  };
  ACTIVE.set(ctx.from.id, session);

  await ctx.reply(
    [
      '🎯 Ranona Daily Challenge',
      '',
      challenge.question,
      '',
      'أرسل إجابتك في رسالة خاصة (الأكثر دقة تربح).',
      `المكافأة: +${challenge.points} نقاط.`,
    ].join('\n'),
  );
}

export async function onDailyMessage(ctx: Context): Promise<boolean> {
  if (!ctx.from) return false;
  const session = ACTIVE.get(ctx.from.id);
  if (!session || session.ended) return false;
  const text = (ctx.message as any)?.text?.trim();
  if (!text) return false;
  session.ended = true;
  ACTIVE.delete(ctx.from.id);
  const normalized = text.replace(/[ًَُِّْ]/g, '').trim().toLowerCase();
  const expected = session.answer.replace(/[ًَُِّْ]/g, '').trim().toLowerCase();
  const isCorrect = normalized === expected;
  await recordDailyParticipation({
    challenge_id: session.challengeId,
    telegram_user_id: ctx.from.id,
    telegram_chat_id: ctx.chat?.id,
    answer: text,
    is_correct: isCorrect,
    points_earned: isCorrect ? session.points : 0,
  });
  if (isCorrect) {
    await addPoints(ctx.from.id, session.points);
    await incrementStat(ctx.from.id, 'correct_answers');
    await ctx.reply(`🎉 صحيح! +${session.points} نقاط.`);
  } else {
    await ctx.reply(`✗ إجابة خاطئة.\nالإجابة الصحيحة: ${session.answer}`);
  }
  return true;
}
