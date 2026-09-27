import { supabase } from '../database/supabase.js';
import { upsertUser } from '../database/users.js';

interface UserStatRow {
  id: string;
  total_messages: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyQuery = any;

/**
 * Use a `any`-casted handle to the Supabase query builder to avoid
 * TS2589 ("Type instantiation is excessively deep") when chaining.
 */
function statsQuery(): AnyQuery {
  return supabase().from('user_stats');
}

/**
 * Increment daily-active stat for a user. Best-effort.
 */
export async function trackUserActivity(telegram_id: number, chatId?: number): Promise<void> {
  await upsertUser({
    telegram_id,
    username: null,
    first_name: null,
    last_name: null,
  });

  const row: UserStatRow | null = (
    await statsQuery()
      .select('id, total_messages')
      .eq('telegram_user_id', telegram_id)
      .maybeSingle()
  ).data as UserStatRow | null;

  if (row) {
    await statsQuery()
      .update({
        total_messages: (row.total_messages || 0) + 1,
        last_active: new Date().toISOString(),
        telegram_chat_id: chatId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
  } else {
    const u: { id: string } | null = (
      await (supabase() as any)
        .from('users')
        .select('id')
        .eq('telegram_id', telegram_id)
        .maybeSingle()
    ).data as { id: string } | null;
    if (!u) return;
    await statsQuery().insert({
      user_id: u.id,
      telegram_user_id: telegram_id,
      telegram_chat_id: chatId ?? null,
      total_messages: 1,
      last_active: new Date().toISOString(),
    });
  }
}
