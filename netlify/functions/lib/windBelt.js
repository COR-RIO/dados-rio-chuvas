/**
 * Espelho (CommonJS) de src/config/windBelt.ts — Netlify Functions não compilam TS,
 * então esta lista é mantida sincronizada manualmente com a fonte usada pelo cliente.
 */

const WIND_BELT_CITIES = [
  { nameMatch: ['angra dos reis'], uf: 'RJ', corridor: 'costeiro', label: 'Angra dos Reis' },
  { nameMatch: ['petropolis'], uf: 'RJ', corridor: 'norte-noroeste', label: 'Petrópolis' },
  { nameMatch: ['juiz de fora'], uf: 'MG', corridor: 'norte-noroeste', label: 'Juiz de Fora' },
  { nameMatch: ['resende'], uf: 'RJ', corridor: 'oeste-sudoeste', label: 'Resende' },
  { nameMatch: ['valenca'], uf: 'RJ', corridor: 'norte-noroeste', label: 'Valença' },
  { nameMatch: ['nova friburgo'], uf: 'RJ', corridor: 'norte-noroeste', label: 'Nova Friburgo' },
  { nameMatch: ['sao paulo', 'mirante'], uf: 'SP', corridor: 'oeste-sudoeste', label: 'São Paulo' },
  { nameMatch: ['sao jose dos campos'], uf: 'SP', corridor: 'oeste-sudoeste', label: 'São José dos Campos' },
  { nameMatch: ['taubate'], uf: 'SP', corridor: 'oeste-sudoeste', label: 'Taubaté' },
  { nameMatch: ['jacarepagua'], uf: 'RJ', corridor: 'interno', label: 'Jacarepaguá' },
  { nameMatch: ['marambaia'], uf: 'RJ', corridor: 'interno', label: 'Marambaia' },
  { nameMatch: ['vila militar'], uf: 'RJ', corridor: 'interno', label: 'Vila Militar' },
  { nameMatch: ['forte de copacabana', 'copacabana'], uf: 'RJ', corridor: 'interno', label: 'Forte de Copacabana' },
];

const WIND_BELT_AIRPORTS = [
  { icao: 'SBJF', label: 'Juiz de Fora', corridor: 'norte-noroeste', priority: 'alta', location: [-21.7924, -43.3853] },
  { icao: 'SBGR', label: 'Guarulhos', corridor: 'oeste-sudoeste', priority: 'alta', location: [-23.4356, -46.4731] },
  { icao: 'SBSP', label: 'Congonhas', corridor: 'oeste-sudoeste', priority: 'alta', location: [-23.6261, -46.6564] },
  { icao: 'SBSJ', label: 'São José dos Campos', corridor: 'oeste-sudoeste', priority: 'opcional', location: [-23.2283, -45.8642] },
  { icao: 'SBMT', label: 'Campo de Marte', corridor: 'oeste-sudoeste', priority: 'opcional', location: [-23.5089, -46.6378] },
  { icao: 'SBGL', label: 'Galeão', corridor: 'interno', priority: 'alta', location: [-22.8099, -43.2506] },
  { icao: 'SBRJ', label: 'Santos Dumont', corridor: 'interno', priority: 'alta', location: [-22.9105, -43.1631] },
  { icao: 'SBSC', label: 'Santa Cruz', corridor: 'interno', priority: 'alta', location: [-22.9328, -43.7183] },
  { icao: 'SBAF', label: 'Campo dos Afonsos', corridor: 'interno', priority: 'alta', location: [-22.8494, -43.3839] },
  { icao: 'SBJR', label: 'Jacarepaguá', corridor: 'interno', priority: 'alta', location: [-22.9878, -43.3703] },
];

const CORRIDORS = ['oeste-sudoeste', 'norte-noroeste', 'costeiro', 'interno'];

module.exports = { WIND_BELT_CITIES, WIND_BELT_AIRPORTS, CORRIDORS };
