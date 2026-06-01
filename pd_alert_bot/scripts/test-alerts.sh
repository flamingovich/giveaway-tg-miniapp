#!/usr/bin/env bash
# Проверка REG + FTD локально (бот должен быть запущен: npm run dev)
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

PORT="${PORT:-8787}"
SECRET="${WEBHOOK_SECRET:-burmalda-keitaro-2026-secret}"
CAMPAIGN="${1:-PD_BIODEP}"
BASE="http://localhost:${PORT}/pd_alert_bot/s2s"
TS="$(date +%s)"

if ! curl -sS -o /dev/null --connect-timeout 1 "http://localhost:${PORT}/health" 2>/dev/null; then
  echo "❌ Бот не запущен на порту ${PORT}."
  echo ""
  echo "Сначала в ДРУГОМ терминале:"
  echo "  cd $(pwd)"
  echo "  npm run dev"
  echo ""
  echo "Потом снова: npm run test:alerts"
  exit 1
fi

echo "→ REG (${CAMPAIGN})"
curl -sS "${BASE}?secret=${SECRET}&campaign=${CAMPAIGN}&status=registration&subid=test-reg-${TS}&revenue=0"
echo ""

echo "→ FTD (${CAMPAIGN})"
curl -sS "${BASE}?secret=${SECRET}&campaign=${CAMPAIGN}&status=sale&subid=test-ftd-${TS}&revenue=45"
echo ""

echo "Готово. Проверь Telegram."
