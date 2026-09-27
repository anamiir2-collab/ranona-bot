import { logger } from './utils/logger.js';
import { getBot, startBot } from './bot/bot.js';
import { registerCommands } from './bot/commands.js';
import { registerCallbacks } from './bot/callbacks.js';
import { onAddedToGroup } from './commands/start.js';
import { onNewMember } from './services/welcome.js';
import { applyProtection } from './commands/protection.js';
import { onXoJoin, onXoMove } from './games/xo.js';
import { onRpsJoin, onRpsPick } from './games/rps.js';
import { onGuessMessage } from './games/guessNumber.js';
import { onQuizAnswer } from './games/quiz.js';
import { onPuzzleMessage } from './games/puzzle.js';
import { onScrambledMessage } from './games/scrambledWords.js';
import { onTypingMessage } from './games/typing.js';
import { onDailyMessage } from './games/dailyChallenge.js';
import { pingSupabase } from './database/supabase.js';
import { Context } from 'telegraf';
import { isGroupChat } from './utils/helpers.js';
import { ensureSettingsFor } from './database/groupSettings.js';
import { upsertGroup } from './database/groups.js';
import { toBotError } from './utils/errors.js';

async function main() {
  logger.info('starting Ranona bot...');

  // Health check
  const ok = await pingSupabase();
  if (!ok) {
    logger.warn('Supabase not reachable — bot will continue but DB ops may fail.');
  }

  const bot = getBot();
  registerCommands(bot);
  registerCallbacks(bot);

  // ============== Group events ==============
  bot.on('new_chat_members', async (ctx: Context) => {
    try {
      // If the bot itself was just added, register the group
      const added = (ctx.message as any)?.new_chat_members as any[];
      const self = await ctx.telegram.getMe();
      if (added?.some((m) => m.id === self.id)) {
        await onAddedToGroup(ctx);
        return;
      }
      // Make sure the group is registered
      if (ctx.chat && isGroupChat(ctx.chat)) {
        const chat = ctx.chat as { id: number; title?: string; type: string };
        const group = await upsertGroup({
          telegram_chat_id: chat.id,
          title: chat.title || 'Group',
          type: chat.type,
        });
        if (group) await ensureSettingsFor(group.id, group.telegram_chat_id);
      }
      await onNewMember(ctx);
    } catch (e) {
      logger.error({ err: e }, 'new_chat_members handler failed');
    }
  });

  bot.on('left_chat_member', async (ctx: Context) => {
    // Best-effort: nothing critical to do for now
  });

  // ============== Game interactions ==============
  bot.action(/^xo_join:(.+)$/, onXoJoin);
  bot.action(/^xo_move:(.+):(\d+)$/, onXoMove);
  bot.action(/^rps_join:(.+)$/, onRpsJoin);
  bot.action(/^rps_pick:(.+):(\w+)$/, onRpsPick);
  bot.action(/^quiz_ans:(.+):(\d+)$/, onQuizAnswer);

  // ============== Music callbacks ==============
  bot.action('m_pause', async (ctx) => {
    if (ctx.chat) {
      const { updateSession } = await import('./database/music.js');
      await updateSession(ctx.chat.id, { status: 'paused' });
    }
    await ctx.answerCbQuery('Paused');
  });
  bot.action('m_resume', async (ctx) => {
    if (ctx.chat) {
      const { updateSession } = await import('./database/music.js');
      await updateSession(ctx.chat.id, { status: 'playing' });
    }
    await ctx.answerCbQuery('Resumed');
  });
  bot.action('m_skip', async (ctx) => {
    await ctx.answerCbQuery('Use /skip');
  });
  bot.action('m_stop', async (ctx) => {
    if (ctx.chat) {
      const { clearQueue, updateSession } = await import('./database/music.js');
      await clearQueue(ctx.chat.id);
      await updateSession(ctx.chat.id, { status: 'stopped', current_track: null });
    }
    await ctx.answerCbQuery('Stopped');
  });
  bot.action('m_queue', async (ctx) => {
    await ctx.answerCbQuery('Use /queue');
  });

  // ============== Protection middleware ==============
  bot.use(async (ctx: Context, next) => {
    // Only apply to text messages inside groups (not commands handled above)
    if (ctx.chat && isGroupChat(ctx.chat) && ctx.message && 'text' in ctx.message) {
      try {
        await applyProtection(ctx);
      } catch (e) {
        logger.error({ err: e }, 'protection middleware failed');
      }
    }
    return next();
  });

  // ============== Text-based game interactions ==============
  // Order matters: try daily first (DM), then group games
  bot.on('text', async (ctx: Context, next) => {
    try {
      const text = (ctx.message as any)?.text?.trim();
      if (!text) return next();
      // Daily challenge answers (private chat)
      if (ctx.chat?.type === 'private') {
        const handled = await onDailyMessage(ctx);
        if (handled) return;
      }
      // Group game answers
      if (ctx.chat && isGroupChat(ctx.chat)) {
        if (await onGuessMessage(ctx)) return;
        if (await onPuzzleMessage(ctx)) return;
        if (await onScrambledMessage(ctx)) return;
        if (await onTypingMessage(ctx)) return;
      }
    } catch (e) {
      logger.error({ err: e }, 'text game handler failed');
    }
    return next();
  });

  await startBot();
}

// ============== Global Error Handlers ==============
process.on('unhandledRejection', (reason) => {
  const err = toBotError(reason);
  logger.error({ err }, 'unhandledRejection');
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'uncaughtException');
  // In production, you might want to exit and let the supervisor restart:
  // process.exit(1);
});

main().catch((e) => {
  logger.error({ err: e }, 'fatal startup error');
  process.exit(1);
});
