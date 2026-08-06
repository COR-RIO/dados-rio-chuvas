import { normalizeString } from '../utils/bairroMapping';

export type RainMacroZone = 'zona-sul' | 'centro' | 'zona-norte' | 'zona-oeste';

export const RAIN_MACRO_ZONE_LABELS: Record<RainMacroZone, string> = {
  'zona-sul': 'Zona Sul',
  centro: 'Centro',
  'zona-norte': 'Zona Norte',
  'zona-oeste': 'Zona Oeste',
};

/**
 * Estação (nome real da rede Alerta Rio, ver stationToBairroMap em utils/bairroMapping.ts) →
 * macrorregião da cidade. PRIMEIRA VERSÃO — geografia conhecida do Rio, ainda sem confirmação
 * contra uma fonte oficial de divisão por estação (ao contrário de windBelt.ts, que já tem
 * confirmação registrada estação a estação). Casos marcados abaixo são os mais discutíveis
 * (fronteira entre regiões) e merecem checagem antes de confiar no alerta de "concentração".
 */
export interface RainZoneStation {
  /** Termos usados para casar com RainStation.name (normalizado, sem acento). Basta um bater. */
  nameMatch: string[];
  zone: RainMacroZone;
}

export const RAIN_ZONE_STATIONS: RainZoneStation[] = [
  // Zona Sul
  { nameMatch: ['copacabana'], zone: 'zona-sul' },
  { nameMatch: ['ipanema'], zone: 'zona-sul' },
  { nameMatch: ['leblon'], zone: 'zona-sul' },
  { nameMatch: ['botafogo'], zone: 'zona-sul' },
  { nameMatch: ['flamengo'], zone: 'zona-sul' },
  { nameMatch: ['laranjeiras'], zone: 'zona-sul' },
  { nameMatch: ['urca'], zone: 'zona-sul' },
  { nameMatch: ['vidigal'], zone: 'zona-sul' },
  { nameMatch: ['rocinha'], zone: 'zona-sul' },
  { nameMatch: ['jardim botanico'], zone: 'zona-sul' },

  // Centro (região central/portuária)
  { nameMatch: ['centro'], zone: 'centro' },
  { nameMatch: ['lapa'], zone: 'centro' },
  { nameMatch: ['saude'], zone: 'centro' },
  // Santa Teresa fica no morro entre Centro e Zona Sul — tratada aqui como Centro por
  // convenção administrativa, mas é fronteiriça.
  { nameMatch: ['santa teresa'], zone: 'centro' },

  // Zona Norte
  { nameMatch: ['tijuca'], zone: 'zona-norte' },
  { nameMatch: ['maracana'], zone: 'zona-norte' },
  { nameMatch: ['vila isabel'], zone: 'zona-norte' },
  { nameMatch: ['grajau'], zone: 'zona-norte' },
  { nameMatch: ['alto da boa vista'], zone: 'zona-norte' },
  { nameMatch: ['grande meier', 'meier'], zone: 'zona-norte' },
  { nameMatch: ['penha'], zone: 'zona-norte' },
  { nameMatch: ['madureira'], zone: 'zona-norte' },
  { nameMatch: ['iraja'], zone: 'zona-norte' },
  { nameMatch: ['anchieta'], zone: 'zona-norte' },
  { nameMatch: ['piedade'], zone: 'zona-norte' },
  { nameMatch: ['ilha do governador'], zone: 'zona-norte' },
  { nameMatch: ['galeao'], zone: 'zona-norte' },
  // São Cristóvão fica na divisa Centro/Zona Norte — classificação oficial (AP3) é Zona Norte,
  // mas colloquialmente às vezes tratado como central. Fronteiriço.
  { nameMatch: ['sao cristovao', 'cristovao'], zone: 'zona-norte' },
  // Estação na divisa Grajaú/Jacarepaguá — lado Grajaú (Zona Norte), mas fronteiriça com a
  // Zona Oeste (Jacarepaguá começa logo depois do túnel). Fronteiriço.
  { nameMatch: ['est. grajau/jacarepagua', 'grajau/jacarepagua'], zone: 'zona-norte' },

  // Zona Oeste
  { nameMatch: ['barra'], zone: 'zona-oeste' },
  { nameMatch: ['recreio'], zone: 'zona-oeste' },
  { nameMatch: ['jacarepagua'], zone: 'zona-oeste' },
  { nameMatch: ['campo grande'], zone: 'zona-oeste' },
  { nameMatch: ['bangu'], zone: 'zona-oeste' },
  { nameMatch: ['santa cruz'], zone: 'zona-oeste' },
  { nameMatch: ['sepetiba'], zone: 'zona-oeste' },
  { nameMatch: ['grota funda'], zone: 'zona-oeste' },
  { nameMatch: ['guaratiba'], zone: 'zona-oeste' },
  { nameMatch: ['av. brasil/mendanha', 'mendanha'], zone: 'zona-oeste' },
];

/** Macrorregião de uma estação de chuva pelo nome, ou null se ainda não mapeada. */
export function getRainStationZone(stationName: string): RainMacroZone | null {
  const normalized = normalizeString(stationName.toLowerCase());
  const entry = RAIN_ZONE_STATIONS.find((z) =>
    z.nameMatch.some((term) => normalized.includes(normalizeString(term)))
  );
  return entry?.zone ?? null;
}
