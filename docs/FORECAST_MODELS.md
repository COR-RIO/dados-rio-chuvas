# Previsão por modelos numéricos (ECMWF, meteoblue, GFS, ICON)

Compara a previsão de chuva e rajada de vários modelos numéricos nos pontos acompanhados pela
meteorologia do COR — a mesma leitura que era feita à mão no "Comparar previsões" do Windy
(`windy.com/multimodel/...`) e anotada numa planilha em papel (ponto × modelo × dia).

Aparece em três lugares, todos com a mesma fonte e o mesmo cálculo:

| Onde | O que mostra |
|---|---|
| Aba **Previsão** (cabeçalho) | Tabela ponto × modelo × dia com os blocos de 3 h acima de um limiar de chuva + faixa estilo Windy (5 dias) do ponto selecionado |
| **Mapa** → camada "Previsão dos modelos" (filtros, à esquerda) | Etiqueta tracejada em cada ponto com a chuva acumulada nas próximas 6/12/24 h e a rajada, quando forte |
| **Mapa** → painel de dados → aba **Previsão** | Resumo ponto × modelo na mesma janela das etiquetas + faixa estilo Windy, com a janela destacada |

## De onde vêm os dados

São duas fontes, buscadas em paralelo. Se o meteoblue falhar (ex.: chave não configurada), só
ele some das telas com o aviso "meteoblue indisponível: …"; os outros modelos continuam.

### 1. Open-Meteo — ECMWF, GFS, ICON, AIFS

**Open-Meteo** — `https://api.open-meteo.com/v1/forecast` ([docs](https://open-meteo.com/en/docs)).

- Agrega a saída oficial dos modelos (ECMWF open data, NOAA GFS, DWD ICON) numa API única.
- **Sem chave e com CORS**: o browser chama direto, sem Netlify Function nem proxy do Vite.
- Uma única requisição traz todos os pontos × modelos (latitude/longitude separados por vírgula).
- Plano gratuito é para uso **não comercial**. Se o volume crescer, existe plano pago com chave
  (`customer-api.open-meteo.com` + `&apikey=`).

Por que não o Windy direto: a [Point Forecast API do Windy](https://api.windy.com/point-forecast/docs)
é paga e não traz o meteoblue.

### 2. meteoblue — API própria, com chave

O meteoblue (o modelo que aparece no topo do "Comparar previsões" do Windy) é comercial e **exige
API key**. O browser não chama direto: passa pela Netlify Function
`netlify/functions/meteoblue-forecast.js` (rota `/api/meteoblue-forecast`), que:

- esconde a chave (mesmo esquema do REDEMET);
- faz 1 chamada por ponto em `https://my.meteoblue.com/packages/<pacote>?lat=…&lon=…&apikey=…&format=json&tz=America/Sao_Paulo&windspeed=kn&forecast_days=5`;
- devolve a série horária de todos os pontos num formato igual ao do Open-Meteo;
- põe **cache de 1 h na borda** — cada ponto consome créditos, então com 8 pontos são ~200
  chamadas/dia no máximo, não importa quantas pessoas estejam com o site aberto.

**Configuração (Netlify → Site settings → Environment variables):**

| Variável | Obrigatória | Valor |
|---|---|---|
| `METEOBLUE_API_KEY` | sim | Chave da conta meteoblue |
| `METEOBLUE_PACKAGE` | não | Pacote da Forecast API. Padrão `basic-1h_wind-1h` (`basic-1h` = chuva, temperatura, vento; `wind-1h` = rajada). Se o plano não incluir `wind-1h`, use `basic-1h` — a rajada fica em branco |

**Como conseguir a chave:** em [meteoblue Weather API](https://content.meteoblue.com/en/business-solutions/weather-apis/free-weather-api)
existe um plano **gratuito por 1 ano** para uso não comercial (cota de créditos/chamadas limitada
— a página da meteoblue cita números diferentes, confira na conta). Para uso institucional
contínuo, avalie o plano pago; o consumo previsto está acima (~200 chamadas/dia). Se a conta
exigir assinatura de URL (`&sig=`), a function ainda não implementa — a resposta será
"This api key requires signature validation".

Em dev, o Vite encaminha `/api/meteoblue-forecast` para a function publicada (`VITE_HISTORICAL_RAIN_PROXY`),
então a chave só precisa estar no Netlify.

> ⚠️ **A validar quando a chave estiver ativa:** a function assume que a chuva horária do meteoblue
> é o acumulado da hora **anterior** (como no Open-Meteo) e que a rajada vem no campo `gust`. Compare
> um ponto com o Windy e ajuste `fetchPoint` em `meteoblue-forecast.js` se necessário.

### Modelos

| `id` no código | Modelo | Resolução | Observações |
|---|---|---|---|
| `ecmwf_ifs` | ECMWF IFS HRES (Europa) | 9 km | Horário até 90 h, depois 3-horário. Roda a cada 6 h |
| `meteoblue` | meteoblue multimodelo (Suíça) | ~ | Via Netlify Function, exige `METEOBLUE_API_KEY` (ver acima) |
| `gfs_seamless` | NOAA GFS (EUA) | 13–25 km | Roda a cada 6 h |
| `icon_seamless` | DWD ICON (Alemanha) | 13 km | Roda a cada 3 h |
| `ecmwf_aifs025_single` | ECMWF AIFS (IA) | 25 km | **Só 6-horário** (o Open-Meteo interpola pra hora a hora, por isso espalha chuva fraca em vários blocos). **Não traz rajada.** Desligado por padrão na aba Previsão e fora do mapa |

Para incluir outro modelo do Open-Meteo, adicione-o em `FORECAST_MODELS`
(`src/services/forecastModelsApi.ts`) com o `id` aceito pelo parâmetro `models` do Open-Meteo.

A ordem das colunas segue a planilha manual: ECMWF, meteoblue, GFS, ICON.

### Variáveis pedidas (Open-Meteo)

`precipitation`, `wind_gusts_10m`, `wind_speed_10m`, `wind_direction_10m`, `temperature_2m`, com
`wind_speed_unit=kn` (nós, como o Windy) e `timezone=America/Sao_Paulo`.

### Pontos

Definidos em `FORECAST_POINTS` (`src/services/forecastModelsApi.ts`) — mesma lista da planilha manual:

| Ponto | Lat | Lng |
|---|---|---|
| Grota Funda | -23.0139 | -43.5236 |
| Santa Cruz | -22.9192 | -43.6847 |
| Mendanha | -22.8565 | -43.4975 |
| Anchieta | -22.8228 | -43.4000 |
| Ilha do Governador | -22.8030 | -43.2050 |
| Pça da Bandeira | -22.9110 | -43.2130 |
| Copacabana | -22.9711 | -43.1863 |
| Barra / Barrinha | -23.0062 | -43.3205 |

A Pça da Bandeira veio da URL do Windy usada pela equipe; os demais são aproximados e devem ser
revisados pela meteorologia. Para adicionar um ponto, basta incluir uma linha nessa lista — ele
aparece automaticamente na aba, no mapa e no painel.

## Como o valor é calculado

### Blocos de 3 h (mesma convenção do Windy)

As duas fontes entregam série **horária**, em que a chuva da hora H é o acumulado da hora anterior
(H-1 → H). O app agrupa em blocos de 3 h nos horários 00, 03, 06 … 21, e **o horário do bloco é o
fim do intervalo**:

> **15h · 1,2 mm · 34 kt** = choveu 1,2 mm **entre 12h e 15h**, e a maior rajada nesse intervalo foi 34 kt.

Isso segue a documentação do Windy ("accumulation of all precipitation for the preceding 3
hours"), então os números ficam alinhados com a planilha feita a partir do Windy.

- **Chuva (mm):** soma das horas H-2, H-1 e H.
- **Rajada (kt):** maior valor nas mesmas 3 horas.
- **Vento médio, direção e temperatura:** valor no horário H.
- Blocos já encerrados (H ≤ hora atual) somem da tela, como no Windy.

Código: `toThreeHourSlots` em `src/services/forecastModelsApi.ts`; `isPast` e `upcomingSlots`
em `src/utils/forecastFormat.ts`.

### Janela do mapa (6 / 12 / 24 h)

`upcomingSlots` pega os próximos N/3 blocos a partir do primeiro bloco ainda não encerrado. A
etiqueta no mapa mostra a soma da chuva nesses blocos (ex.: `3,1 mm/12h`) e a maior rajada,
quando ≥ 22 kt. O período exato ("De Qua 21/10 15h até Qui 22/10 03h") aparece no topo da aba
Previsão do painel de dados, e os blocos correspondentes ficam destacados em lilás nas faixas.

No seletor de modelo do mapa, **"Maior"** mostra o maior acumulado entre ECMWF, meteoblue, GFS e
ICON em cada ponto (cenário mais pessimista); a rajada é a maior entre eles. Modelo indisponível
fica de fora da comparação.

### Cores

| Onde | Critério |
|---|---|
| Etiquetas do mapa | Escala de **acumulado** do app (`getAccumulatedRainLevel`): fraca ≤ 7, moderada ≤ 16, forte ≤ 26, muito forte > 26 mm |
| Blocos de 3 h nas tabelas | ≥ 1 mm azul claro, ≥ 5 amarelo, ≥ 10 laranja, ≥ 25 vermelho |
| Rajada | ≥ 22 kt (~40 km/h) laranja, ≥ 30 kt (~55 km/h) vermelho. Passe o mouse para ver em km/h (1 kt = 1,852 km/h) |

## Atualização

- O hook `useForecastModels` busca ao abrir e repete a cada **30 min** (as rodadas saem a cada 3–6 h).
- No mapa, **só busca quando a camada ou a aba Previsão do painel estão em uso** — a camada vem
  desligada por padrão para não misturar previsão com chuva observada no telão.
- Timeout de 20 s no Open-Meteo e 25 s no meteoblue (`fetchWithTimeout`); erro aparece na tela,
  sem derrubar o resto do mapa.
- O meteoblue usa o cache do browser + 1 h de cache na borda do Netlify; repetir o refresh não
  gasta créditos novos dentro dessa hora.

## Diferenças esperadas em relação ao Windy

Validado em 21/10/2026 contra a foto do Windy (Pça da Bandeira, rodada de 19/10): o **vento
ECMWF bateu bloco a bloco** (ex.: Qua 21 às 15h — Windy 10 kt, app 10,5 kt), confirmando fonte e
fuso. Pequenas diferenças continuam normais:

- **Rodada:** o Windy pode estar mostrando uma rodada diferente (6 h mais nova ou mais velha).
- **Ponto de grade:** o Open-Meteo usa a célula mais próxima do modelo (para a Pça da Bandeira,
  o ECMWF 9 km cai em -22,95 / -43,22, ~4 km ao sul); o Windy interpola de outra forma.
- **AIFS** é 6-horário interpolado — distribuição por bloco é só indicativa.

Para conferir à mão a resposta crua de um ponto:

```
https://api.open-meteo.com/v1/forecast?latitude=-22.911&longitude=-43.213&hourly=precipitation,wind_gusts_10m&models=ecmwf_ifs,gfs_seamless,icon_seamless&wind_speed_unit=kn&timezone=America/Sao_Paulo&forecast_days=3
```

E a previsão feita N dias atrás (útil para comparar com uma foto antiga do Windy ou com a chuva
observada): `https://previous-runs-api.open-meteo.com/v1/forecast?...&hourly=precipitation_previous_day2&start_date=...&end_date=...`.

## Arquivos

| Arquivo | Papel |
|---|---|
| `src/services/forecastModelsApi.ts` | Modelos, pontos, chamadas ao Open-Meteo e ao meteoblue, agregação em blocos de 3 h |
| `netlify/functions/meteoblue-forecast.js` | Proxy do meteoblue (esconde a chave, cache de 1 h). Rota em `netlify.toml`; proxy de dev em `vite.config.ts` |
| `src/hooks/useForecastModels.ts` | Busca + refresh de 30 min |
| `src/utils/forecastFormat.ts` | Fuso de Brasília, blocos encerrados, janela do mapa, cores e formatação |
| `src/pages/ForecastDashboard.tsx` | Aba **Previsão** do cabeçalho |
| `src/components/ForecastModelStrip.tsx` | Faixa estilo Windy (hora, °C, chuva, vento, rajada) — usada na aba e no painel |
| `src/components/ForecastModelLayer.tsx` | Etiquetas tracejadas no mapa + popup comparando modelos |
| `src/components/ForecastPanel.tsx` | Aba **Previsão** do painel de dados do mapa |
| `src/components/MapControls.tsx` (`ForecastLayerControl`) | Controle da camada (mostrar, modelo, janela) |
| `src/components/LeafletMap.tsx` | Liga tudo no mapa; faixa "Previsão — próximas 6/12/24 h" acima da legenda de chuva |
