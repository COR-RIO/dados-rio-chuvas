import { join } from 'path';
import { writeFileSync, existsSync } from 'fs';
import { importOccurrencesFromXlsx } from '../src/utils/importOccurrencesXlsx';
import type { Occurrence } from '../src/types/occurrence';

const cliArgPath = process.argv[2];
const candidateNames = [
  'RelacaoOcorrenciasFinalizadas.xlsx',
  'RelacaodeOcorrencias.xlsx',
  'PlanilhaDadosOcorrencia_20260227140958.xlsx',
];
const xlsxPath =
  cliArgPath ||
  candidateNames
    .map((name) => join(__dirname, '..', name))
    .find((p) => existsSync(p));

if (!xlsxPath) {
  throw new Error(
    'Nenhuma planilha encontrada automaticamente. Informe o caminho: node scripts/import-ocorrencias.ts "C:/caminho/arquivo.xlsx"'
  );
}

// Lê e normaliza as ocorrências a partir do XLSX
const occurrences: Occurrence[] = importOccurrencesFromXlsx(xlsxPath);

// Gera o arquivo TypeScript com os dados prontos para o app
const targetPath = join(__dirname, '..', 'src', 'data', 'occurrences.ts');

const content =
  `import type { Occurrence } from '../types/occurrence';\n\n` +
  `export const OCCURRENCES: Occurrence[] = ${JSON.stringify(occurrences, null, 2)};\n`;

writeFileSync(targetPath, content, 'utf8');

console.log(`Gerado src/data/occurrences.ts com ${occurrences.length} ocorrências.`);

