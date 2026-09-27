import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const env = {
  BOT_TOKEN: required('BOT_TOKEN'),
  BOT_USERNAME: optional('BOT_USERNAME', 'ranona_bot'),
  DEVELOPER_USERNAME: optional('DEVELOPER_USERNAME', 'your_username'),
  CHANNEL_USERNAME: optional('CHANNEL_USERNAME', 'your_channel'),

  SUPABASE_URL: required('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),

  NODE_ENV: optional('NODE_ENV', 'development'),
  LOG_LEVEL: optional('LOG_LEVEL', 'info'),

  MUSIC_API_URL: optional('MUSIC_API_URL', ''),
} as const;

export type Env = typeof env;
