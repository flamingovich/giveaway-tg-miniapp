#!/usr/bin/env bash
# Подключает pd_alert_bot к burmalda.club через nginx Keitaro
set -euo pipefail

INTERNAL_HOST="${INTERNAL_HOST:-10.89.0.1}"
PORT="${PORT:-8787}"
TARGET_DIR="/var/www/keitaro/var/nginx"
INC_FILE="$TARGET_DIR/pd_alert_bot.inc"
COMMON_INC="/etc/nginx/conf.d/locations/1-common.inc"
INCLUDE_LINE="include /var/www/keitaro/var/nginx/pd_alert_bot.inc;"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$TARGET_DIR"

# Старый конфиг ломал nginx -t (location на уровне http)
STALE_CONF="/etc/keitaro/nginx/conf.d/pd_alert_bot.conf"
if [[ -f "$STALE_CONF" ]]; then
  rm -f "$STALE_CONF"
  echo "→ Удалён старый $STALE_CONF"
fi

sed "s/10.89.0.1:8787/${INTERNAL_HOST}:${PORT}/g" \
  "$SCRIPT_DIR/../keitaro/nginx-pd_alert_bot.inc" > "$INC_FILE"

echo "→ Создан $INC_FILE"

# 1-common.inc подключается на уровне server {} — location здесь работает
if podman exec nginx grep -q 'pd_alert_bot.inc' "$COMMON_INC" 2>/dev/null; then
  echo "→ include уже есть в 1-common.inc"
else
  echo "→ Добавляем include в 1-common.inc"
  podman exec nginx sh -c "echo '$INCLUDE_LINE' >> $COMMON_INC"
  echo "⚠️  Строка в 1-common.inc внутри контейнera — после обновления Keitaro запусти скрипт снова."
fi

podman exec nginx nginx -t
podman exec nginx nginx -s reload

echo ""
echo "✅ Готово. Проверь:"
echo "   curl -sI https://burmalda.club/pd_alert_bot/admin | head -3"
echo "   https://burmalda.club/pd_alert_bot/admin"
