#!/usr/bin/env bash
# Roda NO SERVIDOR, disparado manualmente pelo workflow "Configurar nginx + SSL".
# Idempotente: seguro rodar mais de uma vez.
set -euo pipefail

DOMAIN="chovendoagora.cor.rio"
SITE="dados-rio-chuvas"
PORT=3000

if [ ! -f "/etc/nginx/sites-available/${SITE}" ]; then
  sudo tee "/etc/nginx/sites-available/${SITE}" > /dev/null <<CONF
server {
    server_name ${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    listen 80;
}
CONF
  echo "nginx site criado"
else
  echo "nginx site ja existia, mantendo"
fi

sudo ln -sf "/etc/nginx/sites-available/${SITE}" "/etc/nginx/sites-enabled/${SITE}"
sudo nginx -t
sudo systemctl reload nginx
echo "nginx recarregado"

if sudo test -d "/etc/letsencrypt/live/${DOMAIN}"; then
  echo "certificado ja existe para ${DOMAIN}, pulando certbot"
else
  sudo certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos --redirect --register-unsafely-without-email
  echo "certificado emitido"
fi

sudo nginx -t
sudo systemctl reload nginx
echo "OK: ${DOMAIN} configurado"
