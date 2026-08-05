/**
 * Espelho (CommonJS) de src/config/windBelt.ts — Netlify Functions não compilam TS,
 * então esta lista é mantida sincronizada manualmente com a fonte usada pelo cliente.
 */

const WIND_BELT_CITIES = [
  { nameMatch: ['angra dos reis'], uf: 'RJ', corridor: 'costeiro', label: 'Angra dos Reis' },
  // "Petrópolis" não existe como estação automática no INMET — Pico do Couto é a estação real
  // mais próxima (fica dentro do município de Petrópolis, no topo da serra, BR-040 antiga).
  // Confirmado contra /estacoes/T em 2026-08-05 (674 estações, nenhuma "PETROPOLIS" na lista).
  { nameMatch: ['pico do couto'], uf: 'RJ', corridor: 'norte-noroeste', label: 'Petrópolis (Pico do Couto)' },
  { nameMatch: ['juiz de fora'], uf: 'MG', corridor: 'norte-noroeste', label: 'Juiz de Fora' },
  { nameMatch: ['resende'], uf: 'RJ', corridor: 'oeste-sudoeste', label: 'Resende' },
  { nameMatch: ['valenca'], uf: 'RJ', corridor: 'norte-noroeste', label: 'Valença' },
  { nameMatch: ['nova friburgo'], uf: 'RJ', corridor: 'norte-noroeste', label: 'Nova Friburgo' },
  // Trecho entre Petrópolis e a cidade do Rio (BR-040), descendo a serra — confirmado como
  // estação automática real (CD_ESTACAO A603). "Magé"/"Guapimirim" foram checados e NÃO têm
  // estação automática no INMET, por isso não entraram aqui.
  { nameMatch: ['duque de caxias'], uf: 'RJ', corridor: 'norte-noroeste', label: 'Duque de Caxias' },
  { nameMatch: ['sao paulo', 'mirante'], uf: 'SP', corridor: 'oeste-sudoeste', label: 'São Paulo' },
  { nameMatch: ['sao jose dos campos'], uf: 'SP', corridor: 'oeste-sudoeste', label: 'São José dos Campos' },
  { nameMatch: ['taubate'], uf: 'SP', corridor: 'oeste-sudoeste', label: 'Taubaté' },
  { nameMatch: ['jacarepagua'], uf: 'RJ', corridor: 'interno', label: 'Jacarepaguá' },
  { nameMatch: ['marambaia'], uf: 'RJ', corridor: 'interno', label: 'Marambaia' },
  { nameMatch: ['vila militar'], uf: 'RJ', corridor: 'interno', label: 'Vila Militar' },
  { nameMatch: ['forte de copacabana', 'copacabana'], uf: 'RJ', corridor: 'interno', label: 'Forte de Copacabana' },
];

const WIND_BELT_AIRPORTS = [
  // Fora do Rio — cinturão de antecedência.
  { icao: 'SBJF', label: 'Juiz de Fora', corridor: 'norte-noroeste', priority: 'alta', location: [-21.7924, -43.3853] },
  { icao: 'SBGR', label: 'Guarulhos', corridor: 'oeste-sudoeste', priority: 'alta', location: [-23.4356, -46.4731] },
  { icao: 'SBSP', label: 'Congonhas', corridor: 'oeste-sudoeste', priority: 'alta', location: [-23.6261, -46.6564] },
  { icao: 'SBSJ', label: 'São José dos Campos', corridor: 'oeste-sudoeste', priority: 'opcional', location: [-23.2283, -45.8642] },
  { icao: 'SBMT', label: 'Campo de Marte', corridor: 'oeste-sudoeste', priority: 'opcional', location: [-23.5089, -46.6378] },
  // Litoral — costa de SP até o litoral do RJ (oeste → leste). Códigos ICAO confirmados contra
  // a API-REDEMET (aerodromos/info); localidades sem METAR (ex.: Ubatuba/SDUB) foram descartadas.
  { icao: 'SBST', label: 'Santos/Guarujá', corridor: 'costeiro', priority: 'alta', location: [-23.9250, -46.2875] },
  { icao: 'SDAG', label: 'Angra dos Reis', corridor: 'costeiro', priority: 'alta', location: [-22.9753, -44.3072] },
  { icao: 'SBCB', label: 'Cabo Frio', corridor: 'costeiro', priority: 'alta', location: [-22.9217, -42.0742] },
  { icao: 'SBME', label: 'Macaé', corridor: 'costeiro', priority: 'alta', location: [-22.3425, -41.7656] },
  { icao: 'SBCP', label: 'Campos dos Goytacazes', corridor: 'costeiro', priority: 'alta', location: [-21.6983, -41.3017] },
  // Dentro do Rio — confirmação.
  { icao: 'SBGL', label: 'Galeão', corridor: 'interno', priority: 'alta', location: [-22.8099, -43.2506] },
  { icao: 'SBRJ', label: 'Santos Dumont', corridor: 'interno', priority: 'alta', location: [-22.9105, -43.1631] },
  { icao: 'SBSC', label: 'Santa Cruz', corridor: 'interno', priority: 'alta', location: [-22.9328, -43.7183] },
  { icao: 'SBAF', label: 'Campo dos Afonsos', corridor: 'interno', priority: 'alta', location: [-22.8494, -43.3839] },
  { icao: 'SBJR', label: 'Jacarepaguá', corridor: 'interno', priority: 'alta', location: [-22.9878, -43.3703] },
];

const CORRIDORS = ['oeste-sudoeste', 'norte-noroeste', 'costeiro', 'interno'];

module.exports = { WIND_BELT_CITIES, WIND_BELT_AIRPORTS, CORRIDORS };
