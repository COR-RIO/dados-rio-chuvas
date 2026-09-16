#!/usr/bin/env bash
# Roda NO SERVIDOR (via SSH, disparado pelo workflow de deploy). Idempotente:
# pode ser executado em todo deploy sem efeito colateral destrutivo.
set -euo pipefail

APP_DIR="/home/cor/dados-rio-chuvas"
PROGRAM="dados-rio-chuvas"

cd "$APP_DIR"
npm install
npm run build
mkdir -p logs

# server.js não usa dotenv: o wrapper abaixo exporta o .env pro processo do node.
sudo tee "/etc/supervisor/conf.d/${PROGRAM}.conf" > /dev/null <<CONF
[program:${PROGRAM}]
command=/bin/bash -c 'set -a; source ${APP_DIR}/.env; set +a; exec node netlify/functions/server.js'
directory=${APP_DIR}
user=cor
autostart=true
autorestart=true
stdout_logfile=${APP_DIR}/logs/app.log
stderr_logfile=${APP_DIR}/logs/app-error.log
CONF

sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl restart "${PROGRAM}" || sudo supervisorctl start "${PROGRAM}"
sudo supervisorctl status "${PROGRAM}"
