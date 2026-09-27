import { Context } from 'telegraf';
import { ensureSession, getSession, updateSession, addToQueue, listQueue, popNextTrack, clearQueue } from '../database/music.js';
import { getGroupByChatId } from '../database/groups.js';
import { getSettingsByGroupId } from '../database/groupSettings.js';
import { isAdminOrTrusted } from '../moderation/permissions.js';
import { searchTracks, MusicTrack } from './search.js';
import { startPlayback } from './voice.js';
import { writeLog } from '../database/logs.js';
import { musicControlKeyboard } from '../bot/keyboards.js';
import { formatDuration } from '../utils/formatters.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export async function handleMusicPlay(ctx: Context): Promise<void> {
  if (!ctx.chat || ctx.chat.type === 'private') {
    await ctx.reply('متاح في الجروبات فقط.');
    return;
  }
  if (!ctx.from) return;

  const group = await getGroupByChatId(ctx.chat.id);
  if (!group) {
    await ctx.reply('الجروب غير مسجل. استخدم /start.');
    return;
  }
  const settings = await getSettingsByGroupId(group.id);
  if (!settings || !settings.music_enabled) {
    await ctx.reply('الموسيقى معطّلة في هذا الجروب.');
    return;
  }
  if (settings.music_control === 'admins') {
    const ok = await isAdminOrTrusted(ctx.telegram, ctx.chat.id, ctx.from.id);
    if (!ok) {
      await ctx.reply('تحكم الموسيقى مخصص للأدمن فقط.');
      return;
    }
  }
  const args = (ctx.message as any)?.text?.split(/\s+/).slice(1).join(' ').trim();
  if (!args) {
    await ctx.reply('استخدم: /play <اسم الأغنية أو رابط>');
    return;
  }

  if (!env.MUSIC_API_URL) {
    await ctx.reply(
      [
        '⚠️ خاصية Music تتطلب خدمة بحث صوتي خارجية.',
        '',
        'لتفعيلها:',
        '1. شغّل خدمة yt-dlp API على خادمك (مثال: yt-dlp-extractor).',
        '2. عيّن MUSIC_API_URL في ملف .env.',
        '',
        'بدون هذه الخدمة، يمكن للبوت إدارة قوائم الانتظار وإرسال روابط الأغاني فقط.',
      ].join('\n'),
    );
    return;
  }

  const tracks = await searchTracks(args, 1);
  if (tracks.length === 0) {
    await ctx.reply('لم يتم العثور على نتائج. حاول بكلمة أخرى.');
    return;
  }
  const track = tracks[0];
  const session = await ensureSession(group.id, ctx.chat.id);
  if (!session) {
    await ctx.reply('تعذر تهيئة جلسة الموسيقى.');
    return;
  }
  await addToQueue({
    session_id: session.id,
    telegram_chat_id: ctx.chat.id,
    title: track.title,
    url: track.url,
    duration: track.duration,
    requested_by: ctx.from.id,
  });
  await writeLog({
    group_id: group.id,
    telegram_chat_id: ctx.chat.id,
    action: 'MUSIC_PLAY',
    performed_by: ctx.from.id,
    metadata: { title: track.title, url: track.url },
  });

  // If session is idle, start playback
  if (session.status === 'idle' || session.status === 'stopped') {
    const next = await popNextTrack(ctx.chat.id);
    if (next) {
      await updateSession(ctx.chat.id, {
        status: 'playing',
        current_track: {
          title: next.title,
          url: next.url,
          duration: next.duration,
          requested_by: next.requested_by,
        },
        started_by: ctx.from.id,
      });
      await ctx.reply(
        [
          `♪ Now Playing: ${next.title}`,
          track.duration ? `Duration: ${formatDuration(track.duration)}` : '',
          `Requested by: #${next.requested_by}`,
        ].join('\n'),
        musicControlKeyboard(),
      );
      await startPlayback(ctx, ctx.chat.id, {
        title: next.title,
        url: next.url,
        duration: next.duration ?? undefined,
      });
    }
  } else {
    await ctx.reply(`✓ تمت الإضافة للقائمة: ${track.title}`);
  }
}

export async function handleMusicPause(ctx: Context): Promise<void> {
  if (!ctx.chat || !ctx.chat.id) return;
  await updateSession(ctx.chat.id, { status: 'paused' });
  await ctx.reply('⏸ Music paused.');
}

export async function handleMusicResume(ctx: Context): Promise<void> {
  if (!ctx.chat || !ctx.chat.id) return;
  await updateSession(ctx.chat.id, { status: 'playing' });
  await ctx.reply('▶ Music resumed.');
}

export async function handleMusicSkip(ctx: Context): Promise<void> {
  if (!ctx.chat || !ctx.chat.id) return;
  const next = await popNextTrack(ctx.chat.id);
  if (next) {
    await updateSession(ctx.chat.id, {
      status: 'playing',
      current_track: { title: next.title, url: next.url, duration: next.duration },
    });
    await ctx.reply(`⏭ Now Playing: ${next.title}`);
    await startPlayback(ctx, ctx.chat.id, { title: next.title, url: next.url, duration: next.duration ?? undefined });
  } else {
    await updateSession(ctx.chat.id, { status: 'idle', current_track: null });
    await ctx.reply('القائمة فارغة.');
  }
}

export async function handleMusicStop(ctx: Context): Promise<void> {
  if (!ctx.chat || !ctx.chat.id) return;
  await clearQueue(ctx.chat.id);
  await updateSession(ctx.chat.id, { status: 'stopped', current_track: null });
  await writeLog({
    telegram_chat_id: ctx.chat.id,
    action: 'MUSIC_STOP',
    performed_by: ctx.from?.id ?? null,
  });
  await ctx.reply('⏹ Music stopped.');
}

export async function handleMusicQueue(ctx: Context): Promise<void> {
  if (!ctx.chat || !ctx.chat.id) return;
  const queue = await listQueue(ctx.chat.id);
  if (queue.length === 0) {
    await ctx.reply('القائمة فارغة.');
    return;
  }
  const lines = ['Queue:', '', ...queue.map((q, i) => `${i + 1}. ${q.title}`)];
  await ctx.reply(lines.join('\n'));
}

export async function handleMusicNowPlaying(ctx: Context): Promise<void> {
  if (!ctx.chat || !ctx.chat.id) return;
  const session = await getSession(ctx.chat.id);
  if (!session || !session.current_track) {
    await ctx.reply('لا يوجد تشغيل حاليًا.');
    return;
  }
  const track = session.current_track as any;
  await ctx.reply(`♪ Now Playing: ${track.title}`, musicControlKeyboard());
}
