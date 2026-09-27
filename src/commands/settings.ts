import { Context } from 'telegraf';
import { BRAND } from '../config/constants.js';
import { settingsMenuKeyboard } from '../bot/keyboards.js';
import { getGroupByChatId } from '../database/groups.js';
import { getSettingsByGroupId } from '../database/groupSettings.js';

export async function handleSettings(ctx: Context): Promise<void> {
  if (!ctx.chat || ctx.chat.type === 'private') {
    await ctx.reply('إعدادات الجروب متاحة داخل الجروب فقط.');
    return;
  }
  const group = await getGroupByChatId(ctx.chat.id);
  if (!group) {
    await ctx.reply('الجروب غير مسجل. استخدم /start لإعادة التهيئة.');
    return;
  }
  const settings = await getSettingsByGroupId(group.id);
  if (!settings) {
    await ctx.reply('فشل تحميل الإعدادات.');
    return;
  }
  await ctx.reply(
    [
      `${BRAND.NAME} — Group Settings`,
      '',
      'اختر القسم الذي تريد ضبطه:',
      '',
      'Protection • Games • Music • Welcome • Filters • Moderation • Statistics',
    ].join('\n'),
    settingsMenuKeyboard(),
  );
}
