/**
 * Exporta os dados de /api/v1/wind (estações INMET + METAR REDEMET) como KMZ, para abrir em
 * Google Earth/Maps ou qualquer GIS que leia KML. Um Placemark por estação, com ícone/cor por
 * categoria oficial de vento (fraco/moderado/forte/muito forte) — mesmas cores usadas no mapa
 * (src/types/wind.ts), reaplicadas aqui porque Netlify Functions não compilam TS (mesmo motivo
 * de netlify/functions/lib/windBelt.js ser um espelho CommonJS de src/config/windBelt.ts).
 *
 * GET /api/v1/wind/kmz
 * GET /api/v1/wind/kmz?source=redemet   (só estações REDEMET/METAR, aeroportos)
 * GET /api/v1/wind/kmz?source=inmet     (só estações automáticas INMET)
 */

const JSZip = require('jszip');
const v1Wind = require('./v1-wind');

const CACHE_CONTROL_SUCCESS = 'public, max-age=300, s-maxage=300, stale-while-revalidate=60';

const CORS_HEADERS_JSON = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

// Mesmas categorias/cores de src/types/wind.ts (WIND_CATEGORY_COLORS) — mantidas em sincronia
// manualmente, igual ao padrão já usado para o cinturão de estações (lib/windBelt.js).
const CATEGORY_COLORS_RGB = {
  fraco: '7EC9E8',
  moderado: 'F2C744',
  forte: 'E8792C',
  'muito-forte': 'C6273A',
};

const CORRIDOR_LABELS = {
  'oeste-sudoeste': 'Oeste/Sudoeste (São Paulo → Angra)',
  'norte-noroeste': 'Norte/Noroeste (Juiz de Fora → Petrópolis)',
  costeiro: 'Costeiro (Angra → Costa Verde)',
  interno: 'Interno (confirmação dentro do Rio)',
};

const SOURCE_LABELS = { inmet: 'INMET (estação automática)', redemet: 'REDEMET/DECEA (METAR aeroporto)' };

function msToKmh(ms) {
  return ms * 3.6;
}

/** Mesmos limites oficiais de src/types/wind.ts (windCategoryFromSpeedKmh). */
function categoryFromKmh(kmh) {
  const n = Number(kmh);
  if (!(n > 18.4)) return 'fraco';
  if (n <= 51.9) return 'moderado';
  if (n <= 75.9) return 'forte';
  return 'muito-forte';
}

function directionToCardinal(deg) {
  if (deg == null || Number.isNaN(deg)) return '—';
  const dirs = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return dirs[idx];
}

/** KML usa cor no formato aabbggrr (alpha, azul, verde, vermelho) — ordem invertida do #RRGGBB. */
function toKmlColor(rgbHex, alpha = 'ff') {
  const r = rgbHex.slice(0, 2);
  const g = rgbHex.slice(2, 4);
  const b = rgbHex.slice(4, 6);
  return `${alpha}${b}${g}${r}`;
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatObservedAt(iso) {
  try {
    return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) + ' (horário de Brasília)';
  } catch {
    return iso;
  }
}

function buildStylesKml() {
  return Object.entries(CATEGORY_COLORS_RGB)
    .map(([category, rgb]) => {
      const color = toKmlColor(rgb);
      return `
    <Style id="style-${category}">
      <IconStyle>
        <color>${color}</color>
        <scale>1.1</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/shapes/donut.png</href></Icon>
      </IconStyle>
      <LabelStyle><scale>0.8</scale></LabelStyle>
    </Style>`;
    })
    .join('');
}

function buildPlacemarkKml(station) {
  const [lat, lng] = station.location;
  const gustKmh = station.windGustMs != null ? msToKmh(station.windGustMs) : null;
  const speedKmh = msToKmh(station.windSpeedMs);
  const referenceKmh = gustKmh ?? speedKmh;
  const category = categoryFromKmh(referenceKmh);
  const cardinal = directionToCardinal(station.windDirectionDeg);

  const rows = [
    ['Fonte', SOURCE_LABELS[station.source] || station.source],
    ['Código', station.code],
    ['Corredor', CORRIDOR_LABELS[station.corridor] || station.corridor],
    ['Velocidade', `${speedKmh.toFixed(1)} km/h`],
    ['Rajada', gustKmh != null ? `${gustKmh.toFixed(1)} km/h` : 'não informada'],
    ['Direção', station.windDirectionDeg != null ? `${station.windDirectionDeg}° (${cardinal})` : 'variável/indisponível'],
    ['Observado em', formatObservedAt(station.observedAt)],
  ];
  if (station.messageType) rows.push(['Tipo de mensagem', station.messageType]);
  if (station.raw) rows.push(['METAR bruto', station.raw]);

  const description = `<![CDATA[<table>${rows
    .map(([k, v]) => `<tr><td><b>${escapeXml(k)}</b></td><td>${escapeXml(v)}</td></tr>`)
    .join('')}</table>]]>`;

  return `
    <Placemark>
      <name>${escapeXml(station.name)} (${escapeXml(station.code)})</name>
      <description>${description}</description>
      <styleUrl>#style-${category}</styleUrl>
      <ExtendedData>
        <Data name="source"><value>${escapeXml(station.source)}</value></Data>
        <Data name="windCategory"><value>${escapeXml(category)}</value></Data>
        <Data name="windSpeedKmh"><value>${speedKmh.toFixed(1)}</value></Data>
        <Data name="windGustKmh"><value>${gustKmh != null ? gustKmh.toFixed(1) : ''}</value></Data>
        <Data name="observedAt"><value>${escapeXml(station.observedAt)}</value></Data>
      </ExtendedData>
      <Point><coordinates>${lng},${lat},0</coordinates></Point>
    </Placemark>`;
}

function buildKml(stations, docName) {
  const placemarks = stations.map(buildPlacemarkKml).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(docName)}</name>
    <description>${escapeXml(
      `Sensores de vento — dados de ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Gerado a partir de /api/v1/wind (chovendo-agora).`
    )}</description>${buildStylesKml()}${placemarks}
  </Document>
</kml>`;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS_JSON, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS_JSON,
      body: JSON.stringify({ success: false, error: 'Método não permitido' }),
    };
  }

  const source = (event.queryStringParameters || {}).source;
  if (source && source !== 'inmet' && source !== 'redemet') {
    return {
      statusCode: 400,
      headers: CORS_HEADERS_JSON,
      body: JSON.stringify({ success: false, error: "Parâmetro source deve ser 'inmet' ou 'redemet'" }),
    };
  }

  try {
    const windResponse = await v1Wind.handler({ httpMethod: 'GET' });
    const parsed = JSON.parse(windResponse.body);
    if (!parsed.success) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS_JSON,
        body: JSON.stringify({ success: false, error: parsed.error || 'Erro ao consultar dados de vento' }),
      };
    }

    const stations = source ? parsed.data.filter((s) => s.source === source) : parsed.data;

    const docName = source
      ? `Sensores de vento — ${source === 'redemet' ? 'REDEMET' : 'INMET'} (cinturão do Rio)`
      : 'Sensores de vento — cinturão do Rio (INMET + REDEMET)';

    const kml = buildKml(stations, docName);

    const zip = new JSZip();
    zip.file('doc.kml', kml);
    const kmzBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    const filename = `ventos${source ? `-${source}` : ''}-${new Date().toISOString().slice(0, 10)}.kmz`;

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/vnd.google-earth.kmz',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': CACHE_CONTROL_SUCCESS,
      },
      body: kmzBuffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error('v1-wind-kmz error:', err.message);
    return {
      statusCode: 200,
      headers: CORS_HEADERS_JSON,
      body: JSON.stringify({ success: false, error: err.message || 'Erro ao gerar KMZ' }),
    };
  }
};
