# API pública v1 — chuva, vento e radar do Rio de Janeiro

Endpoints estáveis, prontos para consumo por **outros projetos** (fora deste app). São
Netlify Functions que agregam e normalizam as fontes públicas já usadas pelo mapa
(Prefeitura do Rio, AlertaRio, INMET, REDEMET, COR), com CORS aberto e sem necessidade de
chave própria.

**Base URL**: `https://chovendo-agora.netlify.app/api/v1` (ajuste para o domínio do seu deploy).

> As fontes originais (Prefeitura, AlertaRio, COR) são dados públicos. Os dados de vento do
> REDEMET (DECEA) estão sujeitos aos termos de uso da API-REDEMET — confirme se a
> redistribuição para terceiros é permitida antes de divulgar o endpoint `/wind` amplamente.

## GET /api/v1/rain

Chuva em tempo real das estações pluviométricas da Prefeitura do Rio. Sem cache (dados
mudam a cada poucos minutos).

```json
{
  "success": true,
  "fetchedAt": "2026-08-04T18:00:00.000Z",
  "source": "Prefeitura do Rio de Janeiro (websempre)",
  "count": 33,
  "data": [
    {
      "id": "rio-urca-0",
      "name": "Urca",
      "location": [-22.955833, -43.166667],
      "readAt": "2026-08-04T17:55:00-03:00",
      "isNew": false,
      "data": {
        "mm05min": 0, "mm15min": 0, "mm1h": 0, "mm2h": 0,
        "mm3h": 0, "mm4h": 0, "mm24h": 2.4, "mm96h": 12.8, "mmMes": 45.2
      }
    }
  ]
}
```

## GET /api/v1/rain/historical

Histórico de chuvas (BigQuery). Cache de 5 minutos.

Query params: `dateFrom`, `dateTo` (`YYYY-MM-DD`), `station` (nome ou id), `limit` (máx. 10000), `sort` (`asc`|`desc`).

```
GET /api/v1/rain/historical?dateFrom=2026-08-01&dateTo=2026-08-04&limit=500
```

## GET /api/v1/wind

Vento no cinturão do Rio: estações automáticas INMET (fora do Rio, cinturão de
antecedência) + METAR dos aeroportos via REDEMET (dentro e fora do Rio). Cache de 5
minutos. Inclui um resumo por corredor geográfico (`corridorSummary`).

```json
{
  "success": true,
  "fetchedAt": "2026-08-04T18:00:00.000Z",
  "sources": { "inmet": true, "redemet": true },
  "count": 14,
  "data": [
    {
      "id": "redemet-SBGL",
      "name": "Galeão",
      "source": "redemet",
      "code": "SBGL",
      "corridor": "interno",
      "location": [-22.8099, -43.2506],
      "observedAt": "2026-08-04T17:00:00.000Z",
      "windSpeedMs": 5.1,
      "windGustMs": 8.2,
      "windDirectionDeg": 90
    }
  ],
  "corridorSummary": {
    "oeste-sudoeste": { "corridor": "oeste-sudoeste", "maxGustKmh": 18.4, "dominantDirectionDeg": 220, "level": { "level": 0, "label": "Calmo" }, "stationCount": 2 },
    "norte-noroeste": { "...": "..." },
    "costeiro": { "...": "..." },
    "interno": { "...": "..." }
  }
}
```

`corridor` é um de: `oeste-sudoeste`, `norte-noroeste`, `costeiro`, `interno` (ver
`src/types/wind.ts` no repo para o significado de cada um). Se `sources.inmet` ou
`sources.redemet` vier `false`, a variável de ambiente correspondente não está configurada
no deploy e essa fonte fica ausente dos dados (não é erro).

## GET /api/v1/radar

Frames de radar meteorológico do COR (Mendanha/Sumaré). Cache de 1 minuto.

```
GET /api/v1/radar               → { data: { mendanha: {...}, sumare: {...} } }
GET /api/v1/radar?radar=mendanha → { data: { mendanha: {...} } }
```

```json
{
  "success": true,
  "fetchedAt": "2026-08-04T18:00:00.000Z",
  "bounds": [[-24.0797, -44.8854], [-21.5686, -42.1610]],
  "data": {
    "mendanha": {
      "radar": "mendanha",
      "frames": [
        { "timestamp": "2026-08-04T17:55:00.000Z", "imageUrl": "https://dashboardradar.cor.rio/api/frame/mendanha/...png", "filename": "..." }
      ],
      "latestTimestamp": "2026-08-04T17:55:00.000Z",
      "delayMinutes": 5
    }
  }
}
```

`bounds` é `[[latSW, lngSW], [latNE, lngNE]]` — use para posicionar as imagens PNG dos
frames como overlay num mapa (ex.: `L.imageOverlay` no Leaflet).

## Erros

Todos os endpoints devolvem `{ "success": false, "error": "..." }` com HTTP 200 em falhas
de upstream (para simplificar o consumo — sempre cheque `success`), e HTTP 400/405 apenas
para requisições malformadas (método errado, parâmetro inválido).

## Limites

Sem autenticação e sem rate limit próprio — os endpoints herdam os limites das fontes
originais. Se for consumir com alta frequência, respeite os `Cache-Control` de cada rota
(evite pedir `/rain` mais de uma vez a cada poucos segundos, por exemplo).
