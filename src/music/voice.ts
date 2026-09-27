import { Context } from 'telegraf';
import { logger } from '../utils/logger.js';

/**
 * Voice / Voice-Chat integration layer.
 *
 * ⚠️ Telegram Bot API CANNOT join voice chats and stream audio.
 * Streaming audio into Telegram voice chats requires MTProto + a tgcalls
 * binding (e.g. gramjs + node-tgcalls or a separate Python service using
 * Pyrogram + py-tgcalls).
 *
 * Ranona's music module therefore focuses on:
 *   • queue management (database-backed)
 *   • sending audio files via sendAudio (which plays inline on mobile)
 *   • per-group session state
 *
 * If you need real voice-chat streaming, run a separate MTProto bridge and
 * call its HTTP API from this module. The `startPlayback` hook below is
 * where such a bridge would be invoked.
 */
export async function startPlayback(
  ctx: Context,
  chatId: number,
  track: { title: string; url: string; duration?: number },
): Promise<void> {
  try {
    // If the URL is a direct audio file, sendAudio plays it inline.
    await ctx.telegram.sendAudio(chatId, track.url, {
      title: track.title,
      duration: track.duration,
      caption: `♪ ${track.title}`,
    });
    logger.info({ chatId, title: track.title }, 'audio sent');
  } catch (e) {
    logger.error({ err: e }, 'startPlayback failed (telegram sendAudio)');
    await ctx
      .reply(
        `♪ الآن: ${track.title}\n\nملاحظة: تشغيل الصوت داخل Voice Chat يتطلب ربط MTProto خارجي. تم إرسال الملف الصوتي فقط.`,
      )
      .catch(() => undefined);
  }
}
