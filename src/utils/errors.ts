export class BotError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'BOT_ERROR',
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'BotError';
  }
}

export class DatabaseError extends BotError {
  constructor(message: string, cause?: unknown) {
    super(message, 'DB_ERROR', cause);
    this.name = 'DatabaseError';
  }
}

export class PermissionError extends BotError {
  constructor(message = 'Insufficient permissions') {
    super(message, 'PERMISSION_ERROR');
    this.name = 'PermissionError';
  }
}

export class RateLimitError extends BotError {
  constructor(message = 'Too many requests') {
    super(message, 'RATE_LIMIT_ERROR');
    this.name = 'RateLimitError';
  }
}

export class GameStateError extends BotError {
  constructor(message: string) {
    super(message, 'GAME_STATE_ERROR');
    this.name = 'GameStateError';
  }
}

export function isBotError(e: unknown): e is BotError {
  return e instanceof BotError;
}

export function toBotError(e: unknown): BotError {
  if (e instanceof BotError) return e;
  if (e instanceof Error) return new BotError(e.message, 'UNKNOWN', e);
  return new BotError('Unknown error', 'UNKNOWN', e);
}
