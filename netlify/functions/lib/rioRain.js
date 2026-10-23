/**
 * Busca a chuva em tempo real das estações pluviométricas da Prefeitura do Rio, com fallback.
 *
 * Fonte principal: websempre.rio.rj.gov.br/json/chuvas (JSON { objects: [...] }).
 * Fallback: alertario.rio.rj.gov.br/upload/xml/Chuvas.xml — mesmas estações (mesmos nomes e
 * coordenadas), publicado pelo Alerta Rio. Convertido aqui para o MESMO formato do JSON, então
 * quem consome (src/services/rainApi.ts, v1-rain.js) não precisa saber de onde veio.
 *
 * Por que o fallback existe: o websempre passou a filtrar clientes (ex.: User-Agent "curl/*" leva
 * 403) e, a partir da VPS de produção, a requisição começou a falhar — o mapa ficava com 0 estações
 * mesmo com o XML do Alerta Rio no ar. Diferenças do XML: não traz h02/h03 (ficam ausentes; os
 * consumidores já tratam ausência como 0) nem is_new (derivado pela idade da leitura).
 */

const WEBSEMPRE_RAIN_URL = 'https://websempre.rio.rj.gov.br/json/chuvas';
const ALERTARIO_RAIN_XML_URL = 'https://alertario.rio.rj.gov.br/upload/xml/Chuvas.xml';

// User-Agent de navegador: o websempre bloqueia alguns UAs de ferramenta (403).
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

// O websempre às vezes leva 20-30s; sem limite, um upstream travado segura o request inteiro e
// nunca chega no fallback.
const FETCH_TIMEOUT_MS = 12000;

// Leitura com mais de 1h é considerada "não nova" (o XML não traz is_new).
const STALE_AFTER_MS = 60 * 60 * 1000;

async function fetchWithTimeout(url, accept) {
  return fetch(url, {
    headers: { Accept: accept, 'User-Agent': BROWSER_USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

async function fetchWebsempreObjects() {
  const response = await fetchWithTimeout(WEBSEMPRE_RAIN_URL, 'application/json');
  if (!response.ok) throw new Error(`websempre retornou ${response.status}`);
  const json = await response.json();
  if (!Array.isArray(json?.objects) || json.objects.length === 0) {
    throw new Error('websempre retornou JSON sem estações');
  }
  return json.objects;
}

function parseAttributes(tag) {
  const attrs = {};
  for (const match of tag.matchAll(/([\w-]+)="([^"]*)"/g)) attrs[match[1]] = match[2];
  return attrs;
}

function toNumber(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/** Converte o Chuvas.xml do Alerta Rio para o formato de objects do websempre. */
function parseAlertaRioXml(xml) {
  const objects = [];
  for (const [, block] of xml.matchAll(/<estacao\b([\s\S]*?)<\/estacao>/g)) {
    const station = parseAttributes(block.slice(0, block.indexOf('>')));
    const locTag = block.match(/<localizacao\b[^>]*>/);
    const rainTag = block.match(/<chuvas\b[^>]*>/);
    if (!station.nome || !locTag || !rainTag) continue;

    const loc = parseAttributes(locTag[0]);
    const rain = parseAttributes(rainTag[0]);
    // Horário local do Rio sem offset no XML (ex.: "2026-10-23T11:30:00").
    const readAt = rain.hora ? `${rain.hora}-03:00` : null;
    const readAtMs = readAt ? Date.parse(readAt) : NaN;

    objects.push({
      kind: 'pluviometric',
      read_at: readAt,
      name: station.nome,
      is_new: Number.isFinite(readAtMs) && Date.now() - readAtMs <= STALE_AFTER_MS,
      location: [toNumber(loc.latitude), toNumber(loc.longitude)],
      data: {
        m05: toNumber(rain.m05),
        m15: toNumber(rain.m15),
        mes: toNumber(rain.mes),
        h96: toNumber(rain.h96),
        h24: toNumber(rain.h24),
        h01: toNumber(rain.h01),
        h04: toNumber(rain.h04),
      },
    });
  }
  return objects;
}

async function fetchAlertaRioObjects() {
  const response = await fetchWithTimeout(ALERTARIO_RAIN_XML_URL, 'application/xml, text/xml');
  if (!response.ok) throw new Error(`Alerta Rio XML retornou ${response.status}`);
  const objects = parseAlertaRioXml(await response.text());
  if (objects.length === 0) throw new Error('Alerta Rio XML sem estações');
  return objects;
}

/**
 * Retorna { objects, source } no formato do websempre. Lança erro só se as duas fontes falharem.
 */
async function fetchRioRainObjects() {
  try {
    return { objects: await fetchWebsempreObjects(), source: 'websempre' };
  } catch (primaryError) {
    console.warn('Chuva: websempre falhou, usando XML do Alerta Rio:', primaryError.message);
    try {
      return { objects: await fetchAlertaRioObjects(), source: 'alertario-xml' };
    } catch (fallbackError) {
      throw new Error(`websempre: ${primaryError.message}; Alerta Rio: ${fallbackError.message}`);
    }
  }
}

module.exports = { fetchRioRainObjects, parseAlertaRioXml };
