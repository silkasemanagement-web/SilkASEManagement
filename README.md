# SILK™ ASE PlayStation Discord Bot

Production-oriented TypeScript bot for **SILK™ ASE | PS4/PS5 | 300+ POP**: a dual-server ARK: Survival Evolved PlayStation 4 and PlayStation 5 Discord setup (main ASE community + VIP/support Discord), built on **discord.js v14**, **MongoDB**, **Redis**, and **BullMQ**.

## Requirements

- **Node.js** 20.10 or newer (LTS recommended)
- **MongoDB** 6+
- **Redis** 6+

## Quick start

1. Clone or copy this repository and install dependencies:

   ```bash
   npm install
   ```

2. Copy environment template and fill in values:

   ```bash
   cp .env.example .env
   ```

3. Build and run:

   ```bash
   npm run build
   npm start
   ```

   For development with auto-reload:

   ```bash
   npm run dev
   ```

## Environment variables

See `.env.example` for the full list. Critical values:

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Bot token from the Discord Developer Portal |
| `DISCORD_CLIENT_ID` / `DISCORD_APPLICATION_ID` | Application client ID |
| `MAIN_GUILD_ID` | Primary SILK ASE PS4/PS5 community server snowflake |
| `DONATION_GUILD_ID` | SILK ASE VIP/support server snowflake |
| `MONGODB_URI` | Mongo connection string |
| `REDIS_URL` | Redis URL for cache and job queues |
| `DEV_GUILD_ID` | Optional; if set, slash commands deploy to this guild only for faster iteration |
| `USE_SHARDING` / `SHARD_COUNT` | Enable sharding for large deployments |

## Slash command deployment

Register commands with Discord (guild scope when `DEV_GUILD_ID` is set, otherwise global):

```bash
npm run deploy:commands
```

After production build:

```bash
npm run deploy:commands:prod
```

## Docker

From the project root:

```bash
docker compose up -d --build
```

Ensure `MONGODB_URI` and `REDIS_URL` in `.env` point at services reachable from the bot container (often the service names from `docker-compose.yml`).

## PM2

An example ecosystem file is provided as `ecosystem.config.cjs`. Typical usage:

```bash
npm run build
pm2 start ecosystem.config.cjs
```

## Discord Developer Portal

Enable **Message Content Intent** if you rely on non-slash message content (automod, mini-games). Enable **Server Members Intent** for joins, roles, and welcome flows. Invite the bot with appropriate OAuth2 scopes (`bot`, `applications.commands`) and permissions for moderation, channels, and roles.

## Scheduled mini-games and tickets

- Auto-hosted **ASE number** and **ASE dino** events run on shard `0` (`cronHub`): number at minute `0` every 6 hours, dino at minute `30` (UTC cron).
- Channel resolution per guild: Mongo `GuildConfiguration.events.miniGameChannelId`, else `welcome.joinChannelId`, else `modLogChannelId`.
- **`/ticket-close`** queues an HTML transcript (BullMQ `heavy-tasks` worker), posts to `tickets.transcriptLogChannelId` or `modLogChannelId`, then deletes the ticket channel.

## Architecture

- `src/bot.ts` — bootstrap (database, Redis, queues, client, events, login)
- `src/shard.ts` — optional `ShardingManager` entry
- `src/commands/` — slash command modules and `registry.ts`
- `src/events/` — Discord client events
- `src/handlers/` — command, event, and interaction routing
- `src/managers/` — config, logging, cache, queues, rate limits
- `src/models/` — Mongoose schemas
- `src/services/` / `src/automations/` — domain logic

Typecheck only:

```bash
npm run typecheck
```

## License

Private project; adjust licensing as needed for your organization.
