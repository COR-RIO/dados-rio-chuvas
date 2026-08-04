/**
 * Netlify Function: consulta vento (METAR) na API-REDEMET (DECEA) para os aeroportos do
 * cinturão de vento e devolve dados já normalizados (m/s, graus) — evita expor a API key
 * no bundle do cliente e evita parsing de METAR no browser.
 *
 * Variáveis de ambiente:
 * - REDEMET_API_KEY: chave obtida em https://api-redemet.decea.mil.br (cadastro necessário)
 *
 * Query params:
 * - icao: lista de códigos ICAO separados por vírgula (ex.: SBGL,SBRJ,SBGR)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

const CACHE_CONTROL_SUCCESS = 'public, max-age=300, s-maxage=300, stale-while-revalidate=60';

const KT_TO_MS = 0.514444;

function extractMetarRecords(json) {
  const candidates = [json?.data?.data, json?.data, json?.mensagens, json];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

function extractRawText(record) {
  if (typeof record === 'string') return record;
  return record?.mens || record?.message || record?.metar || record?.raw || '';
}

function extractIcao(record, rawText) {
  // id_localidade é o campo real da API-REDEMET (confirmado contra o servidor); icao/localidade
  // ficam como fallback caso o formato mude.
  if (record?.id_localidade) return String(record.id_localidade).toUpperCase();
  if (record?.icao) return String(record.icao).toUpperCase();
  if (record?.localidade) return String(record.localidade).toUpperCase();
  const match = /\b([A-Z]{4})\b/.exec(rawText || '');
  return match ? match[1] : null;
}

/** Extrai grupo de vento do METAR: dddffKT, dddffGffKT, VRBffKT (também aceita MPS). */
function parseWindGroup(rawText) {
  const match = /\b(\d{3}|VRB)(\d{2,3})(G(\d{2,3}))?(KT|MPS)\b/.exec(rawText || '');
  if (!match) return null;

  const [, dir, speedRaw, , gustRaw, unit] = match;
  const factor = unit === 'KT' ? KT_TO_MS : 1;

  return {
    windDirectionDeg: dir === 'VRB' ? null : Number(dir),
    windSpeedMs: Math.round(Number(speedRaw) * factor * 10) / 10,
    windGustMs: gustRaw ? Math.round(Number(gustRaw) * factor * 10) / 10 : null,
  };
}

/** Timestamp do METAR (grupo ddHHMMZ, dia+hora UTC) combinado com mês/ano corrente (UTC). */
function parseObservedAt(record, rawText) {
  // validade_inicial é o campo real da API-REDEMET (confirmado contra o servidor, formato
  // "YYYY-MM-DD HH:MM:SS" em UTC); recebimento/hora ficam como fallback.
  const dateField = record?.validade_inicial || record?.recebimento || record?.hora;
  if (dateField) {
    const iso = String(dateField).replace(' ', 'T');
    const withZone = /Z$/.test(iso) ? iso : `${iso}Z`;
    const parsed = new Date(withZone);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  const match = /\b(\d{2})(\d{2})(\d{2})Z\b/.exec(rawText || '');
  if (!match) return new Date().toISOString();

  const [, dayStr, hourStr, minStr] = match;
  const now = new Date();
  const day = Number(dayStr);
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth();
  // Se o dia do METAR for muito maior que o dia atual, provavelmente é do mês anterior.
  if (day > now.getUTCDate() + 2) {
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }
  return new Date(Date.UTC(year, month, day, Number(hourStr), Number(minStr))).toISOString();
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, error: 'Método não permitido' }),
    };
  }

  const apiKey = process.env.REDEMET_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, error: 'REDEMET não configurado (defina REDEMET_API_KEY)' }),
    };
  }

  const icao = (event.queryStringParameters || {}).icao;
  if (!icao) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, error: 'Parâmetro icao é obrigatório' }),
    };
  }

  try {
    // Domínio e header X-Api-Key conforme orientação oficial do cadastro REDEMET (precedência
    // sobre o query param ?api_key=, que também funciona como fallback).
    const url = `https://api-redemet.decea.gov.br/mensagens/metar/${encodeURIComponent(icao)}`;
    const response = await fetch(url, { headers: { Accept: 'application/json', 'X-Api-Key': apiKey } });

    if (!response.ok) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: false, error: `REDEMET retornou ${response.status}` }),
      };
    }

    const json = await response.json();
    const records = extractMetarRecords(json);

    const stations = records
      .map((record) => {
        const rawText = extractRawText(record);
        const wind = parseWindGroup(rawText);
        const stationIcao = extractIcao(record, rawText);
        if (!wind || !stationIcao) return null;
        return {
          icao: stationIcao,
          observedAt: parseObservedAt(record, rawText),
          windSpeedMs: wind.windSpeedMs,
          windGustMs: wind.windGustMs,
          windDirectionDeg: wind.windDirectionDeg,
          raw: rawText,
        };
      })
      .filter(Boolean);

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Cache-Control': CACHE_CONTROL_SUCCESS },
      body: JSON.stringify({ success: true, data: stations }),
    };
  } catch (err) {
    console.error('REDEMET error:', err.message);
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, error: err.message || 'Erro ao consultar REDEMET' }),
    };
  }
};
