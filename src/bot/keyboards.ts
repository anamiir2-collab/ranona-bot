import { Markup } from 'telegraf';
import { InlineKeyboardButton } from 'telegraf/types';
import { BRAND } from '../config/constants.js';

/**
 * Private chat main menu.
 */
export function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('♪ Music', 'pm_music')],
    [Markup.button.callback('Games', 'pm_games'), Markup.button.callback('Profile', 'pm_profile')],
    [Markup.button.callback('Leaderboard', 'pm_leaderboard'), Markup.button.callback('Daily', 'pm_daily')],
    [Markup.button.callback('Help', 'pm_help'), Markup.button.callback('About', 'pm_about')],
  ] as InlineKeyboardButton.CallbackButton[][]);
}

export function gamesMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('XO', 'g_xo'), Markup.button.callback('RPS', 'g_rps')],
    [Markup.button.callback('Guess Number', 'g_guess'), Markup.button.callback('Quiz', 'g_quiz')],
    [Markup.button.callback('Puzzle', 'g_puzzle'), Markup.button.callback('Scrambled', 'g_scrambled')],
    [Markup.button.callback('Typing', 'g_typing'), Markup.button.callback('Daily', 'g_daily')],
    [Markup.button.callback('« Back', 'pm_back')],
  ] as InlineKeyboardButton.CallbackButton[][]);
}

export function settingsMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Protection', 'set_protection')],
    [Markup.button.callback('Games', 'set_games'), Markup.button.callback('Music', 'set_music')],
    [Markup.button.callback('Welcome', 'set_welcome'), Markup.button.callback('Filters', 'set_filters')],
    [Markup.button.callback('Moderation', 'set_moderation'), Markup.button.callback('Statistics', 'set_stats')],
  ] as InlineKeyboardButton.CallbackButton[][]);
}

export function protectionToggleKeyboard(settings: {
  anti_spam: boolean;
  anti_flood: boolean;
  anti_link: boolean;
  anti_forward: boolean;
  anti_bot: boolean;
  anti_mention: boolean;
  word_filter: boolean;
}) {
  const row = (label: string, field: string, on: boolean) => [
    Markup.button.callback(`${on ? '✓' : '✗'} ${label}`, `toggle:${field}`),
  ];
  return Markup.inlineKeyboard([
    row('Anti Spam', 'anti_spam', settings.anti_spam),
    row('Anti Flood', 'anti_flood', settings.anti_flood),
    row('Anti Link', 'anti_link', settings.anti_link),
    row('Anti Forward', 'anti_forward', settings.anti_forward),
    row('Anti Bot', 'anti_bot', settings.anti_bot),
    row('Anti Mention', 'anti_mention', settings.anti_mention),
    row('Word Filter', 'word_filter', settings.word_filter),
    [Markup.button.callback('« Back', 'set_back')],
  ] as InlineKeyboardButton.CallbackButton[][]);
}

export function confirmKeyboard(yesData: string, noData: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✓ Confirm', yesData),
      Markup.button.callback('✗ Cancel', noData),
    ],
  ] as InlineKeyboardButton.CallbackButton[][]);
}

export function backKeyboard(callbackData = 'pm_back') {
  return Markup.inlineKeyboard([
    [Markup.button.callback('« Back', callbackData)],
  ] as InlineKeyboardButton.CallbackButton[][]);
}

export function musicControlKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⏸ Pause', 'm_pause'), Markup.button.callback('▶ Resume', 'm_resume')],
    [Markup.button.callback('⏭ Skip', 'm_skip'), Markup.button.callback('⏹ Stop', 'm_stop')],
    [Markup.button.callback('Queue', 'm_queue')],
  ] as InlineKeyboardButton.CallbackButton[][]);
}

export function brandHeader(): string {
  return `${BRAND.NAME}\n${BRAND.TAGLINE}`;
}
