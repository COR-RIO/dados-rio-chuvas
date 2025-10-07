import { RainStation } from '../types/rain';
import { getRainLevel } from './rainLevel';

// Mapeamento abrangente de estações para bairros do Rio de Janeiro
export const stationToBairroMap: { [key: string]: string[] } = {
  'copacabana': ['copacabana'],
  'ipanema': ['ipanema'],
  'leblon': ['leblon'],
  'botafogo': ['botafogo'],
  'flamengo': ['flamengo'],
  'laranjeiras': ['laranjeiras'],
  'centro': ['centro', 'lapa', 'santa teresa'],
  'santa teresa': ['santa teresa'],
  'teresa': ['santa teresa'],
  'tijuca': ['tijuca', 'maracanã', 'vila isabel', 'tijuca/muda'],
  'grajaú': ['grajaú'],
  'alto da boa vista': ['alto da boa vista'],
  'barra': ['barra', 'recreio', 'recreio dos bandeirantes', 'barra/barrinha', 'barra/riocentro'],
  'jacarepaguá': ['jacarepaguá', 'jacarepaguá/tanque', 'jacarepaguá/cidade de deus'],
  'campo grande': ['campo grande'],
  'bangu': ['bangu'],
  'santa cruz': ['santa cruz'],
  'sepetiba': ['sepetiba'],
  'ilha do governador': ['ilha do governador', 'galeão'],
  'ilha governador': ['ilha do governador', 'galeão'],
  'governador': ['ilha do governador', 'galeão'],
  'galeão': ['ilha do governador', 'galeão'],
  'galeao': ['ilha do governador', 'galeão'],
  'tauá': ['ilha do governador', 'galeão'],
  'taua': ['ilha do governador', 'galeão'],
  'ponte valente': ['ilha do governador', 'galeão'],
  'valente': ['ilha do governador', 'galeão'],
  'banco de areia': ['ilha do governador', 'galeão'],
  'cocotá': ['ilha do governador', 'galeão'],
  'cocota': ['ilha do governador', 'galeão'],
  'moneró': ['ilha do governador', 'galeão'],
  'monero': ['ilha do governador', 'galeão'],
  'pitangueiras': ['ilha do governador', 'galeão'],
  'zumbi': ['ilha do governador', 'galeão'],
  'cacuia': ['ilha do governador', 'galeão'],
  'freguesia': ['ilha do governador', 'galeão'],
  'freguesia da ilha': ['ilha do governador', 'galeão'],
  'jardim guanabara': ['ilha do governador', 'galeão'],
  'guanabara': ['ilha do governador', 'galeão'],
  'portuguesa': ['ilha do governador', 'galeão'],
  'jardim carioca': ['ilha do governador', 'galeão'],
  'carioca': ['ilha do governador', 'galeão'],
  'ribeira': ['ilha do governador', 'galeão'],
  'ribeira da ilha': ['ilha do governador', 'galeão'],
  'ribeira do governador': ['ilha do governador', 'galeão'],
  'praia da bandeira': ['ilha do governador', 'galeão'],
  'bandeira': ['ilha do governador', 'galeão'],
  'bancários': ['ilha do governador', 'galeão'],
  'bancarios': ['ilha do governador', 'galeão'],
  'penha': ['penha'],
  'madureira': ['madureira'],
  'irajá': ['irajá'],
  'são cristóvão': ['são cristóvão'],
  'sao cristovao': ['são cristóvão'],
  'cristóvão': ['são cristóvão'],
  'cristovao': ['são cristóvão'],
  'são cristovão': ['são cristóvão'],
  'sao cristóvão': ['são cristóvão'],
  'são cristovao': ['são cristóvão'],
  'cristovão': ['são cristóvão'],
  'cristóvao': ['são cristóvão'],
  'grande méier': ['grande méier'],
  'anchieta': ['anchieta'],
  'grota funda': ['grota funda'],
  'grota': ['grota funda'],
  'av. brasil/mendanha': ['av. brasil/mendanha'],
  'piedade': ['piedade'],
  'vidigal': ['vidigal'],
  'rocinha': ['rocinha'],
  'urca': ['urca'],
  'saúde': ['saúde'],
  'jardim botânico': ['jardim botânico'],
  'guaratiba': ['guaratiba'],
  'est. grajaú/jacarepaguá': ['est. grajaú/jacarepaguá'],
  // Variações comuns de nomes de bairros
  'méier': ['grande méier'],
  'méier grande': ['grande méier'],
  'barra da tijuca': ['barra', 'barra/barrinha', 'barra/riocentro'],
  'recreio': ['recreio dos bandeirantes'],
  'bandeirantes': ['recreio dos bandeirantes'],
  'cidade de deus': ['jacarepaguá/cidade de deus'],
  'tanque': ['jacarepaguá/tanque'],
  'riocentro': ['barra/riocentro'],
  'barrinha': ['barra/barrinha'],
  'estação grajaú': ['est. grajaú/jacarepaguá'],
  'estação jacarepaguá': ['est. grajaú/jacarepaguá'],
  'brasil mendanha': ['av. brasil/mendanha'],
  'avenida brasil': ['av. brasil/mendanha'],
  'botânico': ['jardim botânico'],
  'jardim': ['jardim botânico']
};

/**
 * Normaliza uma string removendo acentos e caracteres especiais
 */
export const normalizeString = (str: string): string => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[ç]/g, 'c')
    .replace(/[ã]/g, 'a')
    .replace(/[õ]/g, 'o')
    .replace(/[áàâãä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòôõö]/g, 'o')
    .replace(/[úùûü]/g, 'u');
};

/**
 * Encontra uma estação meteorológica baseada no nome do bairro
 */
export const findStationForBairro = (bairroName: string, stations: RainStation[]): RainStation | null => {
  const bairroKey = bairroName.toLowerCase();
  const possibleStations = stationToBairroMap[bairroKey] || [];
  
  // Busca principal com múltiplas estratégias
  let station = stations.find(station => 
    possibleStations.some(searchStationName => {
      const stationNameLower = station.name.toLowerCase();
      const searchNameLower = searchStationName.toLowerCase();
      
      // Normalizar acentos e caracteres especiais
      const stationNormalized = normalizeString(stationNameLower);
      const searchNormalized = normalizeString(searchNameLower);
      
      // Busca exata
      if (stationNormalized === searchNormalized) return true;
      
      // Busca por inclusão
      if (stationNormalized.includes(searchNormalized)) return true;
      if (searchNormalized.includes(stationNormalized)) return true;
      
      // Busca por palavras-chave (para casos como "Jacarepaguá/Tanque" -> "jacarepaguá")
      const stationWords = stationNormalized.split(/[\s\/\-_]+/);
      const searchWords = searchNormalized.split(/[\s\/\-_]+/);
      
      return stationWords.some(word => 
        searchWords.some(searchWord => 
          word.includes(searchWord) || searchWord.includes(word)
        )
      );
    })
  );
  
  // Se não encontrou, tentar busca mais agressiva para Ilha do Governador e São Cristóvão
  if (!station && (bairroKey.includes('ilha') || bairroKey.includes('governador') || 
      bairroKey.includes('galeão') || bairroKey.includes('galeao') ||
      bairroKey.includes('tauá') || bairroKey.includes('taua') ||
      bairroKey.includes('valente') || bairroKey.includes('cocotá') ||
      bairroKey.includes('cocota') || bairroKey.includes('moneró') ||
      bairroKey.includes('monero') || bairroKey.includes('pitangueiras') ||
      bairroKey.includes('zumbi') || bairroKey.includes('cacuia') ||
      bairroKey.includes('freguesia') || bairroKey.includes('banco') ||
      bairroKey.includes('guanabara') || bairroKey.includes('portuguesa') ||
      bairroKey.includes('carioca') || bairroKey.includes('ribeira') ||
      bairroKey.includes('bandeira') || bairroKey.includes('praia') ||
      bairroKey.includes('bancários') || bairroKey.includes('bancarios'))) {
    station = stations.find(s => {
      const stationName = s.name.toLowerCase();
      return stationName.includes('ilha') && stationName.includes('governador');
    });
  }
  
  // Busca agressiva para São Cristóvão
  if (!station && (bairroKey.includes('são cristóvão') || bairroKey.includes('sao cristovao') ||
      bairroKey.includes('cristóvão') || bairroKey.includes('cristovao') ||
      bairroKey.includes('cristovão') || bairroKey.includes('cristóvao'))) {
    station = stations.find(s => {
      const stationName = s.name.toLowerCase();
      return stationName.includes('são') && stationName.includes('cristóvão');
    });
  }
  
  return station || null;
};

/**
 * Obtém a cor do bairro baseada nas estações meteorológicas próximas
 */
export const getBairroColor = (bairroName: string, stations: RainStation[]): string => {
  const station = findStationForBairro(bairroName, stations);
  
  if (!station) {
    return '#F8FAFC'; // Cinza muito claro para bairros sem dados
  }
  
  const rainLevel = getRainLevel(station.data.h24);
  return rainLevel.color;
};
