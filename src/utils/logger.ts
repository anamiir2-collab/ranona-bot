import pino from 'pino';
import { env } from '../config/env.js';

const isDev = env.NODE_ENV === 'development';

const transport = isDev
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss',
        ignore: 'pid,hostname',
      },
    }
  : undefined;

export const logger = pino({
  level: env.LOG_LEVEL,
  transport,
  redact: {
    paths: [
      'BOT_TOKEN',
      'botToken',
      'SUPABASE_SERVICE_ROLE_KEY',
      'serviceRoleKey',
      '*.token',
      '*.key',
      'req.headers.authorization',
      'env.BOT_TOKEN',
      'env.SUPABASE_SERVICE_ROLE_KEY',
    ],
    censor: '[REDACTED]',
  },
});

export type Logger = typeof logger;

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
