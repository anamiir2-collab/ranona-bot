import { Context } from 'telegraf';
import { isGroupChat } from '../utils/helpers.js';

export async function handleHelp(ctx: Context, edit = false): Promise<void> {
  const text = [
    'Help — Ranona',
    '',
    'الأوامر المتاحة:',
    '',
    '• /start — تشغيل القائمة',
    '• /help — هذه الرسالة',
    '• /profile — ملفك الشخصي',
    '• /rank — المتصدرون',
    '• /stats — إحصائياتك',
    '• /settings — إعدادات الجروب',
    '',
    'Games:',
    '• /xo — لعبة XO',
    '• /rps — حجر ورقة مقص',
    '• /guess — خمّن الرقم',
    '• /quiz — مسابقة',
    '• /puzzle — لغز',
    '• /scrambled — كلمات مبعثرة',
    '• /typing — تحدي الكتابة',
    '• /daily — التحدي اليومي',
    '',
    'Moderation (admin):',
    '• /warn /unwarn',
    '• /mute /unmute',
    '• /ban /unban',
    '• /kick /promote /demote',
    '',
    'Protection (admin):',
    '• /filter word — إضافة كلمة محظورة',
    '• /filters — قائمة الكلمات',
    '• /unfilter word — حذف',
    '',
    'Music:',
    '• /play /pause /resume /skip /stop /queue /nowplaying',
  ].join('\n');

  if (edit && ctx.callbackQuery) {
    await ctx.editMessageText(text, {
      reply_markup: { inline_keyboard: [[{ text: '« Back', callback_data: 'pm_back' }]] },
    });
  } else {
    await ctx.reply(text);
  }
}
