import { Context } from 'telegraf';
import { env } from '../config/env.js';

/**
 * Search for music tracks.
 *
 * ⚠️ IMPORTANT: Telegram Bot API does NOT natively support streaming audio
 * into voice chats. Doing so requires an MTProto client (e.g. PyTgram,
 * gramjs, tgcalls) which is outside the scope of the Bot API.
 *
 * This module supports searching for tracks via a configurable HTTP endpoint
 * (e.g. a self-hosted yt-dlp / youtube-dl-extracted API) configured via
 * `MUSIC_API_URL`. If not configured, the bot will inform the admin.
 */
export interface MusicTrack {
  title: string;
  url: string;
  duration?: number;
  artist?: string;
}

export async function searchTracks(query: string, limit = 5): Promise<MusicTrack[]> {
  if (!env.MUSIC_API_URL) {
    return [];
  }
  const url = `${env.MUSIC_API_URL}/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: MusicTrack[] };
    return json.items || [];
  } catch {
    return [];
  }
}

export async function resolveStreamUrl(trackUrl: string): Promise<string | null> {
  if (!env.MUSIC_API_URL) return null;
  const url = `${env.MUSIC_API_URL}/resolve?url=${encodeURIComponent(trackUrl)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as { stream_url?: string };
    return json.stream_url || null;
  } catch {
    return null;
  }
}
