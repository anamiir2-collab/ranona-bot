import { Telegraf, Context } from 'telegraf';
import { logger } from '../utils/logger.js';
import { rateLimit, safeHandler } from './middleware.js';

import { handleStart } from '../commands/start.js';
import { handleHelp } from '../commands/help.js';
import { handleProfile } from '../commands/profile.js';
import { handleRank } from '../commands/rank.js';
import { handleStats } from '../commands/stats.js';
import { handleSettings } from '../commands/settings.js';

import {
  handleWarn,
  handleUnwarn,
  handleMute,
  handleUnmute,
  handleBan,
  handleUnban,
  handleKick,
  handlePromote,
  handleDemote,
} from '../commands/moderation.js';

import {
  handleFilterAdd,
  handleFilterList,
  handleFilterRemove,
} from '../commands/protection.js';

import {
  handleMusicPlay,
  handleMusicPause,
  handleMusicResume,
  handleMusicSkip,
  handleMusicStop,
  handleMusicQueue,
  handleMusicNowPlaying,
} from '../commands/music.js';

import { handleGamesCommand } from '../commands/games.js';

export function registerCommands(bot: Telegraf<Context>): void {
  // Core
  bot.command('start', rateLimit(), safeHandler(handleStart));
  bot.command('help', rateLimit(), safeHandler(handleHelp));
  bot.command('profile', rateLimit(), safeHandler(handleProfile));
  bot.command('rank', rateLimit(), safeHandler(handleRank));
  bot.command('stats', rateLimit(), safeHandler(handleStats));
  bot.command('settings', rateLimit(), safeHandler(handleSettings));

  // Moderation
  bot.command('warn', rateLimit(), safeHandler(handleWarn));
  bot.command('unwarn', rateLimit(), safeHandler(handleUnwarn));
  bot.command('mute', rateLimit(), safeHandler(handleMute));
  bot.command('unmute', rateLimit(), safeHandler(handleUnmute));
  bot.command('ban', rateLimit(), safeHandler(handleBan));
  bot.command('unban', rateLimit(), safeHandler(handleUnban));
  bot.command('kick', rateLimit(), safeHandler(handleKick));
  bot.command('promote', rateLimit(), safeHandler(handlePromote));
  bot.command('demote', rateLimit(), safeHandler(handleDemote));

  // Protection
  bot.command('filter', rateLimit(), safeHandler(handleFilterAdd));
  bot.command('filters', rateLimit(), safeHandler(handleFilterList));
  bot.command('unfilter', rateLimit(), safeHandler(handleFilterRemove));

  // Music
  bot.command('play', rateLimit(), safeHandler(handleMusicPlay));
  bot.command('pause', rateLimit(), safeHandler(handleMusicPause));
  bot.command('resume', rateLimit(), safeHandler(handleMusicResume));
  bot.command('skip', rateLimit(), safeHandler(handleMusicSkip));
  bot.command('stop', rateLimit(), safeHandler(handleMusicStop));
  bot.command('queue', rateLimit(), safeHandler(handleMusicQueue));
  bot.command('nowplaying', rateLimit(), safeHandler(handleMusicNowPlaying));

  // Games
  bot.command('games', rateLimit(), safeHandler(handleGamesCommand));
  bot.command('xo', rateLimit(), safeHandler(async (ctx) => (await import('../games/xo.js')).handleXo(ctx)));
  bot.command('rps', rateLimit(), safeHandler(async (ctx) => (await import('../games/rps.js')).handleRps(ctx)));
  bot.command('guess', rateLimit(), safeHandler(async (ctx) => (await import('../games/guessNumber.js')).handleGuess(ctx)));
  bot.command('quiz', rateLimit(), safeHandler(async (ctx) => (await import('../games/quiz.js')).handleQuiz(ctx)));
  bot.command('puzzle', rateLimit(), safeHandler(async (ctx) => (await import('../games/puzzle.js')).handlePuzzle(ctx)));
  bot.command('scrambled', rateLimit(), safeHandler(async (ctx) => (await import('../games/scrambledWords.js')).handleScrambled(ctx)));
  bot.command('typing', rateLimit(), safeHandler(async (ctx) => (await import('../games/typing.js')).handleTyping(ctx)));
  bot.command('daily', rateLimit(), safeHandler(async (ctx) => (await import('../games/dailyChallenge.js')).handleDaily(ctx)));

  logger.info('commands registered');
}
