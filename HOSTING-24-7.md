# Run the bot 24/7 (while your PC is off)

**If the bot only runs on your PC (`npm start` or PM2 locally), it stops when that computer sleeps, shuts down, or goes offline.**

Your MongoDB is already cloud-hosted (Atlas). To use the bot while this PC is offline, run the **bot process** on an always-on host using the **same** `.env` values (token, MongoDB, Redis).

## Recommended options

| Option | Best for | Keeps running when PC is off |
|--------|----------|------------------------------|
| **Railway / Render / Fly.io** | Easiest managed hosting | Yes |
| **VPS** (Oracle free, Hetzner, etc.) | Full control + Docker | Yes |
| **PM2 on this PC** | Dev / testing only | **No** (PC must stay on) |

## Before you deploy (important)

1. In `.env`, set **`NODE_ENV=production`**
2. Replace **`REDIS_URL=memory://local`** with your real Redis URL (see `.env.example` — Redis Cloud).  
   - `memory://local` only works for local dev; transcripts/queues are limited.
3. Keep **`MONGODB_URI`** as your Atlas URL (already correct).
4. Do **not** run the bot on two machines at once (duplicate interactions / ticket bugs).

## Push source to GitHub (required for Railway)

Railway builds from your Git repo. The Dockerfile needs **`src/`** and **`scripts/`** on GitHub (not only config files).

From the project folder (`.env` must stay local — never commit it):

```powershell
cd "c:\Users\Trova\OneDrive\Documents\ark-enterprise-discord-bot"
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

If GitHub already has an empty or config-only `main` branch, you may need:

```powershell
git pull origin main --allow-unrelated-histories
# resolve conflicts if any, then:
git push origin main
```

If a **`.env` file was ever committed on GitHub**, rotate Discord token, MongoDB password, and Redis password, delete `.env` on GitHub, and set secrets only in Railway **Variables**.

## Option A — Docker on a VPS (recommended)

1. Copy this project to the VPS (git clone or zip).
2. Copy your `.env` to the server (never commit it to GitHub).
3. Set `REDIS_URL` to cloud Redis (or use the `redis` service in `docker-compose.yml` on the VPS).
4. Run:

```bash
npm run build
npm run deploy:commands:prod
docker compose up -d --build
```

`restart: unless-stopped` keeps the bot running after reboot.

## Option B — Railway / Render worker

1. Connect your GitHub repo or upload the project.
2. Set **start command**: `node dist/src/bot.js`
3. Set **build command**: `npm ci && npm run build`
4. Add all variables from `.env` in the host dashboard.
5. Deploy once; run `npm run deploy:commands` from your PC **once** after deploy (or add to build step).

## Option C — PM2 on a always-on machine (not this offline PC)

On the server that stays on 24/7:

```bash
npm ci
npm run build
npm run deploy:commands:prod
npx pm2 start ecosystem.config.cjs --only ark-enterprise-bot
npx pm2 save
npx pm2 startup
```

## Verify

```bash
npm run health
```

Discord should show **Silk Manager** online. Test `/ticket create` or the ticket panel.

## One-time command deploy (from any machine)

```bash
npm run deploy:commands
```
