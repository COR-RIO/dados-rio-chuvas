# Dados Rio Chuvas

Mapa interativo de chuva em tempo real e histórico para o Rio de Janeiro, com zonas pluviométricas oficiais (33 estações), critérios de 15 min e 1 h (Termos Meteorológicos) e dados acumulados via GCP.

## 🚀 Deploy no Netlify

### Opção 1: Deploy via Git (recomendado)

1. Faça push do código para o GitHub/GitLab/Bitbucket
2. Acesse [netlify.com](https://netlify.com) e faça login
3. **New site from Git** → conecte o repositório
4. **Variáveis de ambiente** (em Site settings → Environment variables):
   - **Modo histórico (GCP):** `GOOGLE_APPLICATION_CREDENTIALS_JSON` (conteúdo do `credentials.json` em uma linha). Ver [GCP_SETUP.md](./GCP_SETUP.md).
   - **Google Maps (opcional):** `VITE_GOOGLE_MAPS_API_KEY` só se for usar o mapa Google; o mapa padrão é **Leaflet** (OpenStreetMap).
5. **Deploy site**

### Opção 2: Deploy manual

```bash
npm run build
```

Arraste a pasta `dist` para o Netlify e configure as variáveis de ambiente no painel do site.

## 📁 Estrutura do projeto

```
src/
├── components/
│   ├── LeafletMap.tsx    # Mapa principal (Leaflet)
│   ├── ZoneRainLayer.tsx # Zonas pluviométricas coloridas por nível de chuva
│   ├── MapControls.tsx   # Filtros (tipo de mapa, 15min/1h/ambos, linhas de influência, histórico)
│   ├── InfluenceLegend.tsx # Legenda (15min, 1h, acumulado)
│   ├── RainStationCard.tsx
│   └── ...
├── hooks/                # useRainData, useCitiesData
├── services/             # Alerta Rio, GCP histórico, citiesApi
├── types/                # rain, alertaRio, etc.
└── utils/
    ├── rainLevel.ts      # Paleta e critérios (15min, 1h, acumulado)
    ├── influenceTheme.ts # Cores das zonas/legenda
    └── ...
data/
├── zonas-pluviometricas.geojson  # 33 zonas oficiais
└── ...
netlify/functions/        # historical-rain (BigQuery)
```

## 🛠️ Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build para produção |
| `npm run preview` | Preview do build |
| `npm run lint` | Verificar código |
| `npm run test:gcp` | Testar query GCP (BigQuery) |

## 🌧️ Funcionalidades

- **Mapa Leaflet** (Rua, Satélite, Escuro) com foco no Rio de Janeiro
- **Zonas pluviométricas** (GeoJSON oficial): cada zona colorida pelo nível de chuva da estação
- **Bolinhas** nas estações com a mesma paleta de cores
- **Dados no mapa:** 15 min (m15), 1 h (h01) ou **Ambos** (zonas = 15 min, bolinhas = 1 h)
- **Linhas de influência:** contorno branco opcional entre as zonas
- **Sem chuva:** zona sem preenchimento (mapa visível); demais níveis com cor sólida
- **Modo histórico (GCP):** instantâneo (uma data + horário) ou acumulado no período (De/Até)
- **Fonte em tempo real:** Alerta Rio (API); fallback e histórico: BigQuery (GCP)

## 📊 Paleta de cores (níveis de chuva)

| Nível       | Cor       | Uso |
|------------|-----------|-----|
| Sem chuva  | `#CCD2D8` | Cinza claro; zona sem preenchimento |
| Baixo      | `#7EC9E8` | Chuva fraca |
| Moderado   | `#42B9EB` | Chuva moderada |
| Alto       | `#2C85B2` | Chuva forte |
| Muito alto | `#13335A` | Chuva muito forte |

Mesma paleta para 15 min, 1 h e acumulado (zonas, bolinhas, tabela e legendas).

## 📐 Critérios oficiais

- **15 min (mm/15min):** Sem chuva 0 | Fraca &lt;1,25 | Moderada 1,25–6,25 | Forte 6,25–12,5 | Muito forte &gt;12,5
- **1 h (mm/h):** Sem chuva 0 | Fraca &lt;5 | Moderada 5–25 | Forte 25,1–50 | Muito forte &gt;50
- **Acumulado (mm no período):** critério Estágio 3 (ex.: fraca &lt;25,4; moderada 25,4–47; etc.)

## 🔧 Tecnologias

- **React** + **TypeScript** + **Vite**
- **Leaflet** + **react-leaflet** (mapa principal)
- **Tailwind CSS**
- **Alerta Rio** (API tempo real)
- **Netlify** (host + Functions para histórico GCP/BigQuery)

## 📄 Documentação adicional

- [GCP_SETUP.md](./GCP_SETUP.md) — Credenciais e variáveis para dados históricos (BigQuery)
- [GOOGLE_MAPS_SETUP.md](./GOOGLE_MAPS_SETUP.md) — Configuração do Google Maps (opcional; o app usa Leaflet por padrão)
