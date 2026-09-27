# Ranona

> Music • Games • Protection • Fun

A production-ready Telegram bot for groups and private chats, built with **Node.js**, **TypeScript**, **Telegraf**, and **Supabase PostgreSQL**.

Ranona ships with:

- 🛡️ **Protection** — Anti-Spam, Anti-Flood, Anti-Link, Anti-Forward, Anti-Mention, Word Filter
- 🔨 **Moderation** — warn / mute / ban / kick / promote / demote with full audit log
- 🎮 **Games** — XO, Rock-Paper-Scissors, Guess Number, Quiz, Puzzles, Scrambled Words, Typing Challenge, Daily Challenge
- 📊 **Points & Leaderboard** — per-user stats, global + per-group rankings
- 🎵 **Music** — queue management with pluggable search/stream backend
- 💾 **Supabase** — full relational schema with indexes, FKs, triggers
- 24/7 deployment-ready

---

## Table of Contents

1. [Architecture](#architecture)
2. [Features](#features)
3. [Requirements](#requirements)
4. [BotFather Setup](#botfather-setup)
5. [Supabase Setup](#supabase-setup)
6. [Database Migration](#database-migration)
7. [Environment Variables](#environment-variables)
8. [Local Development](#local-development)
9. [Build](#build)
10. [Production](#production)
11. [Deployment](#deployment)
   - [Railway](#railway)
   - [Render](#render)
   - [VPS](#vps)
12. [Telegram Privacy Mode](#telegram-privacy-mode)
13. [Music Backend (Voice Chat)](#music-backend-voice-chat)
14. [Troubleshooting](#troubleshooting)
15. [Extending Ranona](#extending-ranona)

---

## Architecture

```
ranona-bot/
├── src/
│   ├── index.ts                  # Entry point + global error handlers
│   ├── config/
│   │   ├── env.ts                # Validates & exposes env vars
│   │   └── constants.ts          # Brand, default settings, points, rate limits
│   ├── bot/
│   │   ├── bot.ts                # Telegraf instance + lifecycle
│   │   ├── commands.ts           # /command → handler registration
│   │   ├── callbacks.ts          # inline-keyboard callback handlers
│   │   ├── middleware.ts         # ignoreBots, rateLimit, safeHandler
│   │   └── keyboards.ts          # inline keyboards (menus, settings, etc.)
│   ├── commands/                 # all /command handlers
│   │   ├── start.ts help.ts profile.ts rank.ts stats.ts settings.ts
│   │   ├── moderation.ts         # re-exports moderation handlers
│   │   ├── protection.ts         # /filter /filters /unfilter + applyProtection
│   │   ├── music.ts games.ts
│   ├── games/                    # game logic + in-memory state
│   │   ├── gameManager.ts xo.ts rps.ts guessNumber.ts quiz.ts
│   │   ├── puzzle.ts scrambledWords.ts typing.ts dailyChallenge.ts
│   ├── music/                    # player, queue, search, voice
│   ├── protection/               # antiSpam antiFlood antiLink antiForward antiBot antiMention wordFilter
│   ├── moderation/               # permissions, warn, mute, ban, kick, actions
│   ├── services/                 # welcome, statistics, leaderboard, logging, rateLimit
│   ├── database/                 # supabase client + per-table modules
│   └── utils/                    # logger, errors, formatters, helpers
├── supabase/migrations/001_initial_schema.sql
├── .env.example
├── .gitignore
├── package.json tsconfig.json eslint.config.js prettier.config.js
└── README.md
```

The project is intentionally **modular**: each feature (game, protection rule, moderation action) lives in its own file, with a single source of truth in `database/` and `bot/commands.ts` for wiring.

---

## Features

### Private Chat (`/start`)
- Brand identity card
- Inline menu: Music / Games / Profile / Leaderboard / Daily / Help / About

### Group Chat
- Auto-register chat + create default `group_settings` row when added
- Post-add welcome + permission checklist
- Per-group protection + moderation (DB-backed)
- Per-group games, music, leaderboards

### Protection
| Feature | Default | Action |
| --- | --- | --- |
| Anti Spam | ON | delete / warn / mute / ban |
| Anti Flood | ON (5 / 3s) | warn / mute |
| Anti Link | ON | delete |
| Anti Forward | OFF | delete / warn / mute |
| Anti Bot | ON | log |
| Anti Mention | ON | warn / mute |
| Word Filter | ON | delete / warn / mute |

### Moderation
`/warn /unwarn /mute /unmute /ban /unban /kick /promote /demote`
- Resolve target via reply, `@username`, or Telegram ID
- Per-chat warn limit + escalation action
- Mute duration: `10m`, `1h`, `30s` supported

### Games
| Command | Description |
| --- | --- |
| `/xo` | 2-player tic-tac-toe |
| `/rps` | 2-player Rock-Paper-Scissors |
| `/guess` | Bot picks 1-100, users guess higher/lower |
| `/quiz` | Multiple-choice question, 30s timer |
| `/puzzle` | First-correct-answer wins |
| `/scrambled` | Reorder scrambled Arabic word |
| `/typing` | First to type the displayed phrase wins |
| `/daily` | Once-per-day challenge with unique answer |

### Points
- Win = +10
- Correct Answer = +5
- Daily Challenge = +20
- All configurable in `src/config/constants.ts` → `POINTS`

### Profile & Leaderboard
- `/profile` shows your points, W/L, correct/wrong, streak, rank
- `/rank` shows global leaderboard (DM) or group leaderboard (in group)

### Music
- `/play <query|url>` `/pause` `/resume` `/skip` `/stop` `/queue` `/nowplaying`
- Per-group queue (DB-backed) with position tracking
- Per-group permission: `everyone` or `admins`
- See [Music Backend](#music-backend-voice-chat) for voice-chat streaming

---

## Requirements

- Node.js ≥ 18
- A Supabase project (free tier works)
- A Telegram bot token (from BotFather)
- (Optional) yt-dlp / ffmpeg if you want to enable music streaming

---

## BotFather Setup

1. Open [@BotFather](https://t.me/BotFather) in Telegram
2. Send `/newbot` → choose a name (e.g. `Ranona`) and a username ending in `bot` (e.g. `ranona_music_bot`)
3. Copy the **HTTP API token** → put it in `.env` as `BOT_TOKEN=...`
4. Run `/setabouttext` and set the about text (e.g. `Ranona — Music • Games • Protection • Fun`)
5. Run `/setuserpic` and upload a logo (optional)
6. Run `/setdescription` and set a description shown on the "Add Member" screen
7. (Optional) Disable Group Privacy if you need to read all messages for protection — see [Telegram Privacy Mode](#telegram-privacy-mode)

---

## Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to provision (≈2 minutes)
3. Open **Project Settings → API**
4. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** secret → `SUPABASE_SERVICE_ROLE_KEY`
5. Add both to your `.env`

> ⚠️ **NEVER** expose the service-role key to the client. Ranona uses it server-side only.

---

## Database Migration

1. Open the Supabase **SQL Editor**
2. Paste the entire contents of `supabase/migrations/001_initial_schema.sql`
3. Click **Run**
4. Confirm tables were created:
   ```sql
   select table_name from information_schema.tables
   where table_schema='public' order by table_name;
   ```
5. The migration also seeds 5 questions + 4 puzzles so Quiz / Puzzle / Daily Challenge work out of the box.

Alternatively, with the Supabase CLI:
```bash
npm i -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
BOT_TOKEN=123456:abcdef...
BOT_USERNAME=ranona_bot
DEVELOPER_USERNAME=your_username
CHANNEL_USERNAME=your_channel

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

NODE_ENV=development
LOG_LEVEL=info

# Optional — for music streaming
MUSIC_API_URL=http://localhost:3100
```

---

## Local Development

```bash
git clone <your-repo-url> ranona-bot
cd ranona-bot
cp .env.example .env
# edit .env
npm install
npm run dev
```

`tsx watch` will hot-reload on file changes.

---

## Build

```bash
npm run build
```

Output goes to `dist/`. The compiled project is runnable via:
```bash
npm start
```

To type-check without emitting:
```bash
npm run typecheck
```

---

## Production

1. Set `NODE_ENV=production`
2. Set `LOG_LEVEL=info` (or `warn` on busy bots)
3. Build: `npm run build`
4. Start: `npm start`
5. Run behind a process supervisor (systemd, PM2, Docker) so the bot auto-restarts

Recommended PM2:
```bash
npm i -g pm2
pm2 start dist/index.js --name ranona --max-memory-restart 500M
pm2 save
pm2 startup
```

---

## Deployment

### Architecture recap

- **GitHub** = source code repository
- **Supabase** = managed PostgreSQL + auth
- **Server** = bot runtime (Railway / Render / VPS)
- **Telegram** = bot platform

### Railway

1. Push the project to GitHub
2. On [railway.app](https://railway.app), **New Project → Deploy from GitHub repo**
3. Add env vars (Settings → Variables): `BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, ...
4. Railway will auto-detect Node.js. Set:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Deploy. The bot runs 24/7.

### Render

1. On [render.com](https://render.com), **New → Background Worker**
2. Connect your GitHub repo
3. Set:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. Add all env vars under **Environment**
5. Deploy. Render keeps background workers running 24/7.

### VPS (systemd)

```bash
# on the server
git clone https://github.com/yourname/ranona-bot.git
cd ranona-bot
npm ci
npm run build
cp .env.example .env && nano .env
```

Create `/etc/systemd/system/ranona.service`:
```ini
[Unit]
Description=Ranona Telegram Bot
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/ranona-bot
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ranona
sudo systemctl status ranona
journalctl -u ranona -f
```

---

## Telegram Privacy Mode

By default, Telegram bots in groups receive only:

- Messages that **start with a `/command`
- Replies to the bot's own messages
- Messages that **mention** the bot (`@bot_username`)

If you want Ranona to see **all messages** (required for Anti-Spam, Anti-Link, Word Filter, etc.), you must **disable Group Privacy**:

1. Open [@BotFather](https://t.me/BotFather)
2. `/mybots` → choose Ranona → **Bot Settings → Group Privacy**
3. Click **Turn off**

Without this, Ranona **will not** be able to delete spammy messages — Telegram simply will not deliver them to the bot. This is documented Telegram behavior; Ranona does not pretend to monitor messages it cannot see.

---

## Music Backend (Voice Chat)

> ⚠️ The Telegram **Bot API** (used by Telegraf) **cannot join voice chats** and stream audio. Doing so requires MTProto + an additional library (e.g. `gramjs` + `node-tgcalls`, or a Python service using `py-tgcalls`).

Ranona's `music/` module ships with:

- `queue.ts` — per-group queue stored in Supabase
- `player.ts` — playback state machine + `/play`, `/skip`, `/stop`, ...
- `search.ts` — pluggable HTTP search adapter (set `MUSIC_API_URL`)
- `voice.ts` — fallback that sends audio files via `sendAudio` (inline playback on mobile)

### To enable real voice-chat streaming

1. Self-host a small service that exposes:
   - `GET /search?q=...` → `{ items: [{ title, url, duration }] }`
   - `GET /resolve?url=...` → `{ stream_url }`
   - A tgcalls worker that joins the voice chat and plays `stream_url`
2. Set `MUSIC_API_URL` in `.env`
3. Ranona will use it automatically. Without it, `/play` returns an informative message and falls back to sending audio files inline.

### Suggested stack

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) for searching + extracting stream URLs
- [py-tgcalls](https://github.com/pytgcalls/pytgcalls) or [node-tgcalls](https://github.com/tgcallsjs/tgcalls) for joining the voice chat

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Missing required env var: BOT_TOKEN` | `.env` not loaded or value missing |
| `Supabase ping failed` | Check `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` |
| Bot does not respond to non-command messages | Disable **Group Privacy** in BotFather |
| `/ban` returns "تأكد من صلاحيات البوت" | Make Ranona an administrator in the group with **Ban Users** permission |
| `/play` says music service missing | Set `MUSIC_API_URL` (see [Music Backend](#music-backend-voice-chat)) |
| Quiz returns "no questions" | Re-run the SQL migration; the seed block inserts sample questions |
| Bot stops after crash | Run under PM2 / systemd / Render Worker / Railway — never raw `node` in prod |
| TypeScript errors | Run `npm run typecheck` and fix imports |

---

## Extending Ranona

### Add a new game

1. Create `src/games/mygame.ts` exporting `async function handleMygame(ctx: Context)`.
2. Register it in `src/bot/commands.ts`:
   ```ts
   bot.command('mygame', rateLimit(), safeHandler(handleMygame));
   ```
3. Add it to the Games menu in `src/bot/keyboards.ts`.

### Add a new protection rule

1. Create `src/protection/myRule.ts` exporting `function detect(ctx: Context): boolean`.
2. Add a `my_rule` boolean column to `group_settings` (new migration).
3. Call `detect()` from `applyProtection()` in `src/commands/protection.ts`.

### Add a new moderation action

1. Implement it in `src/moderation/myAction.ts`.
2. Re-export from `src/commands/moderation.ts`.
3. Register the `/myaction` command in `src/bot/commands.ts`.

### Add new questions / puzzles

```sql
insert into questions (question, category, difficulty, options, correct_answer, points, language)
values ('سؤال جديد؟', 'general', 'medium', '["خ1","خ2","خ3","خ4"]'::jsonb, 'خ2', 5, 'ar');

insert into puzzles (question, answer, difficulty, points, language)
values ('لغز جديد؟', 'الإجابة', 'medium', 10, 'ar');
```

---

## License

MIT © Ranona
