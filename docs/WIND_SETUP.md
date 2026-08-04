# Cinturão de vento (INMET + REDEMET)

Camada opcional no mapa ("Cinturão de vento") que mostra vento/rajada em estações regionais
(INMET) e aeroportos (REDEMET) fora do Rio, para dar antecedência antes que um sistema de vento
forte chegue à Região Metropolitana.

## INMET (estações automáticas)

A lista de estações (`https://apitempo.inmet.gov.br/estacoes/T`) é pública, sem autenticação — o
app usa ela para descobrir dinamicamente os códigos das estações do cinturão (Angra dos Reis,
Petrópolis, Juiz de Fora, Resende, Valença, Nova Friburgo, São Paulo, São José dos Campos,
Taubaté, Jacarepaguá, Marambaia, Vila Militar, Forte de Copacabana) filtrando por nome/UF — ver
`src/config/windBelt.ts` (`WIND_BELT_CITIES`) e `src/services/inmetWindApi.ts`.

**As observações horárias (vento/rajada) exigem token.** A rota de 3 segmentos
`/estacao/{ini}/{fim}/{codigo}`, documentada em vários tutoriais de 2019–2023, hoje devolve `204`
vazio silenciosamente para qualquer estação/data (confirmado testando direto contra o servidor
real — não é bug do app, nem falta de dado momentânea). A rota que funciona de fato é
`/token/estacao/{ini}/{fim}/{codigo}/{token}` (sem token válido, devolve o texto `CHAVE INVÁLIDA!`
com status 200).

1. Defina `VITE_INMET_TOKEN` (client-side — o token do INMET não expõe nada sensível além de
   dados meteorológicos já públicos, então não precisa de Netlify Function como o REDEMET).
2. Não há um formulário de autoatendimento público e estável para gerar esse token no momento
   desta escrita — verifique a área "Meus Dados"/cadastro em https://portal.inmet.gov.br ou
   contate o SAC do INMET. Se a URL de cadastro mudar, atualize esta nota.

Sem `VITE_INMET_TOKEN` configurada, a camada de vento das estações regionais fica vazia (REDEMET
continua funcionando normalmente). Se uma estação matched não tiver dado disponível (ex.:
`CD_SITUACAO` diferente de `Operante`, como já visto acontecer com Forte de Copacabana), ela
simplesmente não aparece no mapa, sem quebrar o restante.

## REDEMET (METAR de aeroportos)

Exige cadastro e API key (chave secreta — não pode ir para o bundle do cliente):

1. Cadastre-se em https://api-redemet.decea.mil.br e gere uma API key.
2. Defina a variável de ambiente `REDEMET_API_KEY` (servidor, **não** `VITE_*`):
   - Local: adicione `REDEMET_API_KEY=...` no `.env` (não commitar).
   - Netlify: Site settings → Environment variables → `REDEMET_API_KEY` → novo deploy.
3. A Netlify Function `netlify/functions/redemet-wind.js` usa a key para consultar METAR dos
   aeroportos definidos em `WIND_BELT_AIRPORTS` (`src/config/windBelt.ts`: Galeão, Santos Dumont,
   Guarulhos, Congonhas, Santa Cruz, Juiz de Fora, e opcionalmente Campo dos Afonsos, São José dos
   Campos, Campo de Marte) e devolve vento já convertido para m/s.

Sem `REDEMET_API_KEY` configurada, a function responde com um erro amigável (200, não 500) e a
camada de vento mostra só os dados do INMET.

## Escopo desta fase

Só INMET (estações regionais) e REDEMET (aeroportos). Vento do Alerta Rio (só a estação Vidigal
tem anemômetro) ficou de fora por não haver uma API JSON pública confirmada — ver
`src/hooks/useWindData.ts` para o ponto de extensão caso isso mude no futuro.

O índice de alerta atual (`src/hooks/useWindData.ts`, `buildCorridorSummary`) usa só a maior
rajada observada por corredor e a tendência (subindo/estável/caindo) frente à última leitura —
não inclui radar, satélite ou descargas elétricas.
