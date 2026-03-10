# Configuração do Google Maps (opcional)

O mapa principal do projeto usa **Leaflet** com tiles (OpenStreetMap, Satélite, etc.) e **não exige** chave do Google Maps. Este guia só é necessário se você for usar o componente **GoogleMap** (ex.: tela alternativa ou migração).

## Quando a chave é necessária

- Só é obrigatória se o app exibir o componente `GoogleMap.tsx` e a variável `VITE_GOOGLE_MAPS_API_KEY` estiver sendo lida no código.
- O fluxo padrão (telas atuais) usa `LeafletMap` e não depende do Google Maps.

## Como obter a chave da API do Google Maps

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Ative as APIs:
   - **Maps JavaScript API**
   - Geocoding API (opcional, para funcionalidades futuras)
4. Em **Credenciais**, crie uma nova **Chave de API**
5. (Recomendado) Restrições:
   - Tipo: Referenciadores HTTP
   - Inclua `localhost:*` e o domínio de produção (ex.: `https://*.netlify.app`)

## Configuração no projeto

1. Crie `.env.local` na raiz (não commitar):

```env
VITE_GOOGLE_MAPS_API_KEY=sua_chave_aqui
```

2. Reinicie o servidor:

```bash
npm run dev
```

## Deploy (Netlify)

Se usar Google Maps em produção, em **Site settings → Environment variables** adicione:

- `VITE_GOOGLE_MAPS_API_KEY`: sua chave de API

## Resumo

| Recurso              | Usado no app atual |
|----------------------|---------------------|
| Mapa principal       | **Leaflet** (sem Google) |
| Tiles (Rua, Satélite, etc.) | Leaflet / provedores configurados no código |
| Dados históricos     | GCP BigQuery (ver [GCP_SETUP.md](./GCP_SETUP.md)) |

Para o funcionamento atual do mapa e das zonas pluviométricas, **não é necessário** configurar o Google Maps.
