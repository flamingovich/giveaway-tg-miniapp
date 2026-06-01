#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

if [[ ! -f .env ]]; then
  echo "Create .env from .env.example first"
  exit 1
fi

npm install
npm run set-webhook

if command -v pm2 >/dev/null 2>&1; then
  pm2 delete pd-alert-bot 2>/dev/null || true
  AUTO_SET_WEBHOOK=0 pm2 start npm --name pd-alert-bot -- start
  pm2 save
  echo "Started with pm2: pd-alert-bot"
else
  echo "pm2 not found. Run manually: npm start"
fi

echo ""
echo "S2S URL — send /s2s to the bot in Telegram"
echo "Health: curl https://burmalda.club/health (after nginx configured)"
