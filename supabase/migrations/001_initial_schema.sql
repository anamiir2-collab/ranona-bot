-- ============================================================
-- Ranona Bot - Initial Schema
-- Music • Games • Protection • Fun
-- ============================================================
-- Run this in Supabase SQL Editor (or via `supabase db push`)
-- ============================================================

-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- USERS
-- ============================================================
create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  telegram_id bigint unique not null,
  username text,
  first_name text,
  last_name text,
  points integer default 0 not null,
  games_played integer default 0 not null,
  games_won integer default 0 not null,
  games_lost integer default 0 not null,
  correct_answers integer default 0 not null,
  wrong_answers integer default 0 not null,
  streak integer default 0 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists idx_users_telegram_id on public.users(telegram_id);
create index if not exists idx_users_points on public.users(points desc);

-- ============================================================
-- GROUPS
-- ============================================================
create table if not exists public.groups (
  id uuid primary key default uuid_generate_v4(),
  telegram_chat_id bigint unique not null,
  title text not null,
  type text not null default 'supergroup',
  owner_id bigint,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists idx_groups_telegram_chat_id on public.groups(telegram_chat_id);

-- ============================================================
-- GROUP MEMBERS
-- ============================================================
create table if not exists public.group_members (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  telegram_user_id bigint not null,
  role text default 'member',
  joined_at timestamptz default now() not null,
  unique(group_id, telegram_user_id)
);

create index if not exists idx_gm_group_id on public.group_members(group_id);
create index if not exists idx_gm_user_id on public.group_members(telegram_user_id);

-- ============================================================
-- GROUP SETTINGS
-- ============================================================
create table if not exists public.group_settings (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid unique references public.groups(id) on delete cascade,
  protection_enabled boolean default true,
  anti_spam boolean default true,
  anti_flood boolean default true,
  anti_link boolean default true,
  anti_forward boolean default false,
  anti_bot boolean default true,
  anti_mention boolean default true,
  word_filter boolean default true,
  flood_threshold integer default 5,
  flood_window_seconds integer default 3,
  spam_action text default 'delete',
  flood_action text default 'warn',
  link_action text default 'delete',
  forward_action text default 'delete',
  mention_action text default 'warn',
  welcome_enabled boolean default true,
  welcome_message text default 'أهلًا بك {name} في {group}',
  rules text,
  warn_limit integer default 3,
  warn_action text default 'mute',
  mute_duration integer default 600,
  music_enabled boolean default true,
  music_control text default 'everyone',
  games_enabled boolean default true,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists idx_gs_group_id on public.group_settings(group_id);

-- ============================================================
-- WARNINGS
-- ============================================================
create table if not exists public.warnings (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid references public.groups(id) on delete cascade,
  telegram_chat_id bigint not null,
  telegram_user_id bigint not null,
  reason text,
  warned_by bigint not null,
  count integer default 1,
  created_at timestamptz default now() not null
);

create index if not exists idx_warn_group_user on public.warnings(telegram_chat_id, telegram_user_id);
create index if not exists idx_warn_created on public.warnings(created_at desc);

-- ============================================================
-- FILTERS (Word Filter)
-- ============================================================
create table if not exists public.filters (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid references public.groups(id) on delete cascade,
  telegram_chat_id bigint not null,
  word text not null,
  action text default 'delete',
  added_by bigint not null,
  created_at timestamptz default now() not null,
  unique(telegram_chat_id, word)
);

create index if not exists idx_filters_chat on public.filters(telegram_chat_id);

-- ============================================================
-- BANNED USERS
-- ============================================================
create table if not exists public.banned_users (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid references public.groups(id) on delete cascade,
  telegram_chat_id bigint not null,
  telegram_user_id bigint not null,
  reason text,
  banned_by bigint not null,
  expires_at timestamptz,
  created_at timestamptz default now() not null
);

create index if not exists idx_banned_chat_user on public.banned_users(telegram_chat_id, telegram_user_id);

-- ============================================================
-- MUTED USERS
-- ============================================================
create table if not exists public.muted_users (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid references public.groups(id) on delete cascade,
  telegram_chat_id bigint not null,
  telegram_user_id bigint not null,
  reason text,
  muted_by bigint not null,
  duration_seconds integer,
  expires_at timestamptz,
  created_at timestamptz default now() not null
);

create index if not exists idx_muted_chat_user on public.muted_users(telegram_chat_id, telegram_user_id);

-- ============================================================
-- TRUSTED USERS
-- ============================================================
create table if not exists public.trusted_users (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid references public.groups(id) on delete cascade,
  telegram_chat_id bigint not null,
  telegram_user_id bigint not null,
  added_by bigint not null,
  created_at timestamptz default now() not null,
  unique(telegram_chat_id, telegram_user_id)
);

create index if not exists idx_trusted_chat_user on public.trusted_users(telegram_chat_id, telegram_user_id);

-- ============================================================
-- GAMES
-- ============================================================
create table if not exists public.games (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid references public.groups(id) on delete cascade,
  telegram_chat_id bigint not null,
  game_type text not null,
  created_by bigint not null,
  status text default 'waiting',
  winner_id bigint,
  metadata jsonb,
  created_at timestamptz default now() not null,
  finished_at timestamptz
);

create index if not exists idx_games_chat on public.games(telegram_chat_id);
create index if not exists idx_games_status on public.games(status);
create index if not exists idx_games_created on public.games(created_at desc);

-- ============================================================
-- GAME PLAYERS
-- ============================================================
create table if not exists public.game_players (
  id uuid primary key default uuid_generate_v4(),
  game_id uuid references public.games(id) on delete cascade,
  telegram_user_id bigint not null,
  symbol text,
  score integer default 0,
  joined_at timestamptz default now() not null,
  unique(game_id, telegram_user_id)
);

create index if not exists idx_gp_game on public.game_players(game_id);
create index if not exists idx_gp_user on public.game_players(telegram_user_id);

-- ============================================================
-- GAME MOVES
-- ============================================================
create table if not exists public.game_moves (
  id uuid primary key default uuid_generate_v4(),
  game_id uuid references public.games(id) on delete cascade,
  telegram_user_id bigint not null,
  move jsonb not null,
  created_at timestamptz default now() not null
);

create index if not exists idx_gm_game on public.game_moves(game_id);

-- ============================================================
-- QUESTIONS (for Quiz / Daily Challenge)
-- ============================================================
create table if not exists public.questions (
  id uuid primary key default uuid_generate_v4(),
  question text not null,
  category text,
  difficulty text default 'medium',
  options jsonb,
  correct_answer text not null,
  points integer default 5,
  language text default 'ar',
  created_at timestamptz default now() not null
);

create index if not exists idx_q_cat on public.questions(category);
create index if not exists idx_q_diff on public.questions(difficulty);

-- ============================================================
-- ANSWERS (user answers to questions)
-- ============================================================
create table if not exists public.answers (
  id uuid primary key default uuid_generate_v4(),
  question_id uuid references public.questions(id) on delete cascade,
  telegram_user_id bigint not null,
  telegram_chat_id bigint not null,
  answer text not null,
  is_correct boolean default false,
  points_earned integer default 0,
  created_at timestamptz default now() not null
);

create index if not exists idx_ans_user on public.answers(telegram_user_id);

-- ============================================================
-- PUZZLES
-- ============================================================
create table if not exists public.puzzles (
  id uuid primary key default uuid_generate_v4(),
  question text not null,
  answer text not null,
  difficulty text default 'medium',
  points integer default 10,
  language text default 'ar',
  created_at timestamptz default now() not null
);

-- ============================================================
-- DAILY CHALLENGES
-- ============================================================
create table if not exists public.daily_challenges (
  id uuid primary key default uuid_generate_v4(),
  challenge_date date not null,
  challenge_type text not null,
  reference_id uuid,
  question text not null,
  answer text not null,
  points integer default 20,
  created_at timestamptz default now() not null,
  unique(challenge_date)
);

create index if not exists idx_dc_date on public.daily_challenges(challenge_date);

-- ============================================================
-- DAILY CHALLENGE PARTICIPATIONS (prevent duplicates)
-- ============================================================
create table if not exists public.daily_challenge_participations (
  id uuid primary key default uuid_generate_v4(),
  challenge_id uuid references public.daily_challenges(id) on delete cascade,
  telegram_user_id bigint not null,
  telegram_chat_id bigint,
  answer text,
  is_correct boolean default false,
  points_earned integer default 0,
  created_at timestamptz default now() not null,
  unique(challenge_id, telegram_user_id)
);

create index if not exists idx_dcp_user_date on public.daily_challenge_participations(telegram_user_id, challenge_id);

-- ============================================================
-- USER STATS
-- ============================================================
create table if not exists public.user_stats (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid unique references public.users(id) on delete cascade,
  telegram_chat_id bigint,
  total_messages integer default 0,
  last_active timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================================
-- LEADERBOARDS (cached view per group)
-- ============================================================
create table if not exists public.leaderboards (
  id uuid primary key default uuid_generate_v4(),
  telegram_chat_id bigint,
  telegram_user_id bigint not null,
  scope text default 'group',
  points integer default 0,
  games_won integer default 0,
  updated_at timestamptz default now() not null,
  unique(telegram_chat_id, telegram_user_id, scope)
);

create index if not exists idx_lb_chat_points on public.leaderboards(telegram_chat_id, points desc);
create index if not exists idx_lb_scope_points on public.leaderboards(scope, points desc);

-- ============================================================
-- MUSIC SESSIONS
-- ============================================================
create table if not exists public.music_sessions (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid references public.groups(id) on delete cascade,
  telegram_chat_id bigint not null,
  status text default 'idle',
  current_track jsonb,
  started_by bigint,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(telegram_chat_id)
);

create index if not exists idx_ms_chat on public.music_sessions(telegram_chat_id);

-- ============================================================
-- MUSIC QUEUE
-- ============================================================
create table if not exists public.music_queue (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references public.music_sessions(id) on delete cascade,
  telegram_chat_id bigint not null,
  title text not null,
  url text not null,
  duration integer,
  requested_by bigint not null,
  position integer not null,
  created_at timestamptz default now() not null
);

create index if not exists idx_mq_session on public.music_queue(session_id);
create index if not exists idx_mq_chat_pos on public.music_queue(telegram_chat_id, position);

-- ============================================================
-- LOGS (audit trail)
-- ============================================================
create table if not exists public.logs (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid references public.groups(id) on delete cascade,
  telegram_chat_id bigint,
  action text not null,
  target_user bigint,
  performed_by bigint,
  reason text,
  metadata jsonb,
  created_at timestamptz default now() not null
);

create index if not exists idx_logs_chat on public.logs(telegram_chat_id);
create index if not exists idx_logs_action on public.logs(action);
create index if not exists idx_logs_created on public.logs(created_at desc);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  tbl text;
begin
  for tbl in
    select unnest(array['users','groups','group_settings','music_sessions','user_stats','leaderboards'])
  loop
    execute format('drop trigger if exists trg_%s_updated on public.%s;', tbl, tbl);
    execute format('create trigger trg_%s_updated before update on public.%s for each row execute function public.handle_updated_at();', tbl, tbl);
  end loop;
end$$;

-- ============================================================
-- SEED DATA: SAMPLE QUESTIONS & PUZZLES
-- ============================================================
insert into public.questions (question, category, difficulty, options, correct_answer, points, language)
values
  ('ما عاصمة مصر؟', 'geography', 'easy', '["القاهرة","الإسكندرية","أسوان","الأقصر"]'::jsonb, 'القاهرة', 5, 'ar'),
  ('كم عدد القارات في العالم؟', 'general', 'easy', '["5","6","7","8"]'::jsonb, '7', 5, 'ar'),
  ('ما هو أكبر كوكب في المجموعة الشمسية؟', 'science', 'medium', '["الأرض","المشتري","زحل","المريخ"]'::jsonb, 'المشتري', 5, 'ar'),
  ('من مؤلف رواية البؤساء؟', 'literature', 'hard', '["شكسبير","فيكتور هوغو","تولستوي","ديكنز"]'::jsonb, 'فيكتور هوغو', 10, 'ar'),
  ('ما عاصمة اليابان؟', 'geography', 'easy', '["بكين","سيول","طوكيو","بانكوك"]'::jsonb, 'طوكيو', 5, 'ar')
on conflict do nothing;

insert into public.puzzles (question, answer, difficulty, points, language)
values
  ('شيء كلما أخذت منه كبر، فما هو؟', 'الحفرة', 'easy', 10, 'ar'),
  ('ما هو الشيء الذي له أسنان ولا يعض؟', 'المشط', 'easy', 10, 'ar'),
  ('ما هو الشيء الذي يكتب ولا يقرأ؟', 'القلم', 'easy', 10, 'ar'),
  ('شيء يمشي بلا أرجل ويبكي بلا عيون، فما هو؟', 'السحاب', 'medium', 15, 'ar')
on conflict do nothing;

-- ============================================================
-- DONE
-- ============================================================
