/**
 * PM2 ecosystem file. Supports single process or sharded manager.
 * Usage: pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: "ark-enterprise-bot",
      script: "dist/src/bot.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 15,
      min_uptime: "10s",
      max_memory_restart: "900M",
      env: {
        NODE_ENV: "production",
        USE_SHARDING: "false",
      },
    },
    {
      name: "ark-enterprise-bot-shard",
      script: "dist/src/shard.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        USE_SHARDING: "true",
      },
    },
  ],
};
