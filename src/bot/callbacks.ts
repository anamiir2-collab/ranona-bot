import { Telegraf, Context } from 'telegraf';
import { logger } from '../utils/logger.js';
import { BRAND, LINKS } from '../config/constants.js';
import { mainMenuKeyboard, settingsMenuKeyboard } from './keyboards.js';
import { getGroupByChatId } from '../database/groups.js';
import { getSettingsByGroupId } from '../database/groupSettings.js';

export function registerCallbacks(bot: Telegraf<Context>): void {
  // ============== Private Chat Main Menu ==============
  bot.action('pm_back', async (ctx) => {
    await ctx.editMessageText(`${BRAND.NAME}\n${BRAND.TAGLINE}`, mainMenuKeyboard());
    await ctx.answerCbQuery();
  });

  bot.action('pm_music', async (ctx) => {
    await ctx.editMessageText(
      '♪ Music\n\nفي المحادثة الخاصة، يمكن تصفح الأوامر فقط. شغّل الموسيقى داخل جروب عبر:\n\n/play <query> — تشغيل\n/pause — إيقاف مؤقت\n/resume — استئناف\n/skip — تخطّي\n/stop — إيقاف\n/queue — القائمة\n/nowplaying — الآن',
      { reply_markup: { inline_keyboard: [[{ text: '« Back', callback_data: 'pm_back' }]] } },
    );
    await ctx.answerCbQuery();
  });

  bot.action('pm_games', async (ctx) => {
    const { gamesMenuKeyboard } = await import('./keyboards.js');
    await ctx.editMessageText('Games\nاختر لعبة:', gamesMenuKeyboard());
    await ctx.answerCbQuery();
  });

  bot.action('pm_profile', async (ctx) => {
    if (!ctx.from) {
      await ctx.answerCbQuery('لا يمكن قراءة المستخدم');
      return;
    }
    const { handleProfile } = await import('../commands/profile.js');
    await handleProfile(ctx, true);
    await ctx.answerCbQuery();
  });

  bot.action('pm_leaderboard', async (ctx) => {
    const { handleRank } = await import('../commands/rank.js');
    await handleRank(ctx, true);
    await ctx.answerCbQuery();
  });

  bot.action('pm_daily', async (ctx) => {
    const { handleDaily } = await import('../games/dailyChallenge.js');
    await handleDaily(ctx);
    await ctx.answerCbQuery();
  });

  bot.action('pm_help', async (ctx) => {
    const { handleHelp } = await import('../commands/help.js');
    await handleHelp(ctx, true);
    await ctx.answerCbQuery();
  });

  bot.action('pm_about', async (ctx) => {
    await ctx.editMessageText(
      `About Ranona\n\n${BRAND.NAME}\n${BRAND.TAGLINE}\n\nDeveloper:\n@${LINKS.DEVELOPER}\n\nChannel:\n@${LINKS.CHANNEL}`,
      { reply_markup: { inline_keyboard: [[{ text: '« Back', callback_data: 'pm_back' }]] } },
    );
    await ctx.answerCbQuery();
  });

  // Games menu callbacks
  ['g_xo', 'g_rps', 'g_guess', 'g_quiz', 'g_puzzle', 'g_scrambled', 'g_typing', 'g_daily'].forEach(
    async (id) => {
      // handled lazily below
    },
  );

  bot.action(/^g_(xo|rps|guess|quiz|puzzle|scrambled|typing|daily)$/, async (ctx) => {
    const map: Record<string, string> = {
      xo: 'للعب XO داخل الجروب استخدم: /xo',
      rps: 'للعب Rock Paper Scissors استخدم: /rps',
      guess: 'للعب Guess Number استخدم: /guess',
      quiz: 'للعب Quiz استخدم: /quiz',
      puzzle: 'لعرض لغز استخدم: /puzzle',
      scrambled: 'للعب Scrambled Words استخدم: /scrambled',
      typing: 'للعب Typing Challenge استخدم: /typing',
      daily: 'لمشاركة Daily Challenge استخدم: /daily',
    };
    const m = ctx.match?.[1] as keyof typeof map;
    await ctx.answerCbQuery();
    await ctx.editMessageText(map[m] || 'لعبة غير معروفة.', {
      reply_markup: { inline_keyboard: [[{ text: '« Back', callback_data: 'pm_games' }]] },
    });
  });

  // ============== Settings ==============
  bot.action('set_back', async (ctx) => {
    await ctx.editMessageText('Group Settings', settingsMenuKeyboard());
    await ctx.answerCbQuery();
  });

  bot.action('set_protection', async (ctx) => {
    await handleProtectionView(ctx);
    await ctx.answerCbQuery();
  });

  bot.action(/^toggle:(anti_spam|anti_flood|anti_link|anti_forward|anti_bot|anti_mention|word_filter)$/, async (ctx) => {
    if (!ctx.chat || ctx.chat.type === 'private') {
      await ctx.answerCbQuery('متاح في الجروبات فقط');
      return;
    }
    const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from!.id);
    if (member.status !== 'creator' && member.status !== 'administrator') {
      await ctx.answerCbQuery('هذا الإجراء مخصص للأدمن');
      return;
    }
    const { getGroupByChatId } = await import('../database/groups.js');
    const { toggleSetting } = await import('../database/groupSettings.js');
    const group = await getGroupByChatId(ctx.chat.id);
    if (!group) {
      await ctx.answerCbQuery('الجروب غير مسجل بعد');
      return;
    }
    const field = ctx.match?.[1] as any;
    const updated = await toggleSetting(group.id, field);
    if (!updated) {
      await ctx.answerCbQuery('فشل التحديث');
      return;
    }
    await handleProtectionView(ctx, updated);
    await ctx.answerCbQuery('تم التحديث');
  });

  logger.info('callbacks registered');
}

async function handleProtectionView(ctx: Context, settings?: any) {
  if (!ctx.chat || ctx.chat.type === 'private') {
    await ctx.editMessageText('متاح في الجروبات فقط.');
    return;
  }
  const group = await getGroupByChatId(ctx.chat.id);
  if (!group) return;
  let s = settings;
  if (!s) s = await getSettingsByGroupId(group.id);
  if (!s) return;
  const { protectionToggleKeyboard } = await import('./keyboards.js');
  await ctx.editMessageText(
    [
      'Protection Settings',
      '',
      'Anti Spam: ' + (s.anti_spam ? 'ON' : 'OFF'),
      'Anti Flood: ' + (s.anti_flood ? 'ON' : 'OFF'),
      'Anti Link: ' + (s.anti_link ? 'ON' : 'OFF'),
      'Anti Forward: ' + (s.anti_forward ? 'ON' : 'OFF'),
      'Anti Bot: ' + (s.anti_bot ? 'ON' : 'OFF'),
      'Anti Mention: ' + (s.anti_mention ? 'ON' : 'OFF'),
      'Word Filter: ' + (s.word_filter ? 'ON' : 'OFF'),
      '',
      'اضغط على أي ميزة للتبديل.',
    ].join('\n'),
    protectionToggleKeyboard(s),
  );
}
