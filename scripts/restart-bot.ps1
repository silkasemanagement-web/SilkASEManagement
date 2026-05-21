# Full bot restart — single instance (run from project root)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot + "\.."

Write-Host "Stopping existing bot processes..."
Get-CimInstance Win32_Process -Filter "name = 'node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match 'ark-enterprise-discord-bot|dist[\\/]src[\\/]bot\.js' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

if (Get-Command pm2 -ErrorAction SilentlyContinue) {
  pm2 delete ark-enterprise-bot 2>$null
  pm2 delete ark-enterprise-bot-shard 2>$null
}

Start-Sleep -Seconds 2

Write-Host "Building..."
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Deploying slash commands..."
npm run deploy:commands
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Health check..."
npm run health
if ($LASTEXITCODE -ne 0) { Write-Host "Health check reported issues (see above)." }

if (Get-Command pm2 -ErrorAction SilentlyContinue) {
  Write-Host "Starting with PM2 (auto-restart on crash)..."
  pm2 start ecosystem.config.cjs --only ark-enterprise-bot
  pm2 save 2>$null
  Write-Host "PM2 status:"
  pm2 list
} else {
  Write-Host "PM2 not installed — starting with npm start (stops when terminal closes)."
  Write-Host "Install PM2: npm install -g pm2"
  Write-Host "For 24/7 while PC is off, see HOSTING-24-7.md"
  npm start
}
