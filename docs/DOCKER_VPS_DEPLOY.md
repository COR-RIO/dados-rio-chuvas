# Deploy em VPS com Docker

Guia completo para deploying do projeto em uma VPS usando Docker.

## Pré-requisitos

- Docker 20.10+
- Docker Compose 2.0+
- Uma VPS com Linux (Ubuntu 20.04+ recomendado)
- SSH acesso à VPS
- Domínio apontado para o IP da VPS

## 1. Preparar Credenciais

Antes de fazer deploy, você precisa ter o arquivo `credentials.json` (Google Cloud):

```bash
# Localmente, na sua máquina:
cp credentials/credentials.json credentials/credentials.json.backup

# Você vai copiar isso para a VPS no próximo passo
```

## 2. Deploy na VPS

### Via SSH

```bash
# 1. SSH para a VPS
ssh usuario@seu-vps.com

# 2. Clone o repositório
git clone https://github.com/seu-usuario/dados-rio-chuvas.git
cd dados-rio-chuvas

# 3. Crie o arquivo .env com suas credenciais
cat > .env << EOF
# Node Environment
NODE_ENV=production
PORT=3000

# Google Cloud
GOOGLE_CLOUD_PROJECT=seu-projeto-gcp

# Supabase
SUPABASE_URL=https://seu-project.supabase.co
SUPABASE_KEY=sua-chave-supabase

# Google Maps
VITE_GOOGLE_MAPS_API_KEY=sua-chave-google-maps

# Outras APIs
ALERTA_RIO_API_KEY=sua-chave
INMET_TOKEN=seu-token
OCORRENCIAS_API_BASE_URL=seu-url
OCORRENCIAS_API_USERNAME=seu-usuario
OCORRENCIAS_API_PASSWORD=sua-senha
REDEMET_API_KEY=sua-chave-optional
EOF

# 4. Copie o credentials.json
mkdir -p credentials
# Via SCP de sua máquina local:
# scp credentials/credentials.json usuario@seu-vps.com:~/dados-rio-chuvas/credentials/

# Ou crie/edite direto lá
nano credentials/credentials.json

# 5. Build e inicie os containers
docker-compose up -d

# 6. Verifique o status
docker-compose logs -f app
```

## 3. Nginx Proxy (Recomendado)

Para usar HTTPS, cache e melhor performance, configure um Nginx em frente ao Docker:

```bash
# Instale Nginx (se não tiver)
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y

# Crie config do site
sudo nano /etc/nginx/sites-available/dados-rio

# Adicione:
```

```nginx
upstream app {
    server localhost:3000;
}

server {
    listen 80;
    server_name seu-dominio.com www.seu-dominio.com;
    
    location / {
        proxy_pass http://app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts mais altos para funções pesadas
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Cache para assets estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        proxy_pass http://app;
        proxy_cache_valid 200 1d;
        expires 7d;
    }
}

server {
    listen 443 ssl http2;
    server_name seu-dominio.com www.seu-dominio.com;
    
    # HTTPS será configurado pelo Certbot
    # ... resto da configuração igual ao bloco 80
}
```

```bash
# Ative o site
sudo ln -s /etc/nginx/sites-available/dados-rio /etc/nginx/sites-enabled/

# Teste config
sudo nginx -t

# Obtenha certificado HTTPS gratuito com Let's Encrypt
sudo certbot --nginx -d seu-dominio.com -d www.seu-dominio.com

# Recarregue Nginx
sudo systemctl reload nginx
```

## 4. Gerenciamento dos Containers

```bash
# Ver status
docker-compose ps

# Ver logs da aplicação
docker-compose logs -f app

# Ver logs do Redis (opcional)
docker-compose logs -f redis

# Reiniciar
docker-compose restart

# Parar
docker-compose down

# Rebuild (após atualizar código)
docker-compose up -d --build

# Limpar volumes (CUIDADO: deleta dados)
docker-compose down -v
```

## 5. CI/CD com GitHub Actions

Crie `.github/workflows/deploy.yml`:

```yaml
name: Deploy para VPS

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy via SSH
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd ~/dados-rio-chuvas
            git pull origin main
            docker-compose up -d --build
            docker-compose exec -T app npm run build
```

Adicione os secrets no GitHub (Settings → Secrets):
- `VPS_HOST`: IP ou domínio da VPS
- `VPS_USER`: usuario SSH
- `VPS_SSH_KEY`: chave SSH privada

## 6. Monitoramento

### Health Check

A aplicação expõe `/health` endpoint:

```bash
curl http://seu-dominio.com/health
# { "status": "ok", "timestamp": "2024-01-01T12:00:00.000Z" }
```

### Logs Estruturados

```bash
# Ver últimas 100 linhas
docker-compose logs app --tail=100

# Ver logs em tempo real
docker-compose logs -f app

# Exportar logs
docker-compose logs app > logs.txt
```

## 7. Troubleshooting

### Build falha

```bash
# Limpe tudo e rebuild
docker system prune -a
docker-compose down
docker-compose up -d --build
```

### Credenciais não funcionam

```bash
# Verifique se credentials.json está montado
docker-compose exec app ls -la credentials/

# Teste acesso ao GCP
docker-compose exec app node -e "
  const google = require('@google-cloud/bigquery');
  console.log('Google Cloud SDK OK');
"
```

### Funções não carregam

```bash
# Check do servidor
docker-compose exec app npm run dev

# Ou mire logs
docker-compose logs app | grep "Função carregada"
```

### Porta 3000 em uso

```bash
# Mude a porta no docker-compose.yml
# Ou libere a porta
sudo lsof -i :3000
kill -9 <PID>
```

## 8. Backup e Restauração

```bash
# Backup do dados
docker-compose exec app tar czf /tmp/backup.tar.gz data/

# Copie para sua máquina
scp usuario@seu-vps.com:/tmp/backup.tar.gz ./

# Restaure
docker-compose exec app tar xzf /tmp/backup.tar.gz
```

## 9. Atualizações

```bash
# Pull do repositório
git pull origin main

# Rebuild se tiver mudanças no Dockerfile
docker-compose up -d --build

# Reinicie se for só código Node
docker-compose restart app
```

## 10. Performance Tips

- Use Redis para cache (já incluído no docker-compose.yml)
- Configure max_connections do banco de dados
- Use CDN para assets (Cloudflare, etc)
- Ative gzip no Nginx
- Monitore memoria/CPU: `docker stats`

## Suporte

Para issues, consulte:
- Docker docs: https://docs.docker.com
- Docker Compose: https://docs.docker.com/compose
- Nginx: https://nginx.org/en/docs
