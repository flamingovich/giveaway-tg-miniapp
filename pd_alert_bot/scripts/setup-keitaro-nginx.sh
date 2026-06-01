#!/usr/bin/env bash
# Подключает pd_alert_bot к burmalda.club через nginx Keitaro
set -euo pipefail

INTERNAL_HOST="${INTERNAL_HOST:-10.89.0.1}"
PORT="${PORT:-8787}"
TARGET_DIR="/var/www/keitaro/var/nginx"
INC_FILE="$TARGET_DIR/pd_alert_bot.inc"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

sed "s/10.89.0.1:8787/${INTERNAL_HOST}:${PORT}/g" \
  "$SCRIPT_DIR/../keitaro/nginx-pd_alert_bot.inc" > "$INC_FILE"

echo "→ Создан $INC_FILE"

# Проверяем, подхватывает ли Keitaro var/nginx
if podman exec nginx grep -q 'var/nginx' /etc/nginx/conf.d/local/keitaro/www.inc 2>/dev/null; then
  echo "→ www.inc уже включает var/nginx — должно работать"
elif podman exec nginx grep -q 'pd_alert_bot.inc' /etc/nginx/conf.d/local/keitaro/www.inc 2>/dev/null; then
  echo "→ include уже есть"
else
  echo "→ Добавляем include в www.inc (в контейнере)"
  podman exec nginx sh -c "grep -q pd_alert_bot.inc /etc/nginx/conf.d/local/keitaro/www.inc || echo 'include /var/www/keitaro/var/nginx/pd_alert_bot.inc;' >> /etc/nginx/conf.d/local/keitaro/www.inc"
  echo "⚠️  Строка в www.inc внутри контейнера — после обновления Keitaro может слететь. Тогда запусти скрипт снова."
fi

podman exec nginx nginx -t
podman exec nginx nginx -s reload

echo ""
echo "✅ Готово. Проверь:"
echo "   curl -sI https://burmalda.club/pd_alert_bot/admin | head -3"
echo "   https://burmalda.club/pd_alert_bot/admin"
