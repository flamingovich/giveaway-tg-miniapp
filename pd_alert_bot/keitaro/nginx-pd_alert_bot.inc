# Keitaro nginx — прокси на pd_alert_bot
# Кладётся на сервер в /var/www/keitaro/var/nginx/pd_alert_bot.inc

location /pd_alert_bot/ {
    proxy_pass http://10.89.0.1:8787/pd_alert_bot/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
