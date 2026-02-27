import { join } from 'path';
import { writeFileSync } from 'fs';
import { importOccurrencesFromXlsx } from '../src/utils/importOccurrencesXlsx';
import type { Occurrence } from '../src/types/occurrence';

// Caminho da planilha original de ocorrências
const xlsxPath = join(__dirname, '..', 'PlanilhaDadosOcorrencia_20260227140958.xlsx');

// Lê e normaliza as ocorrências a partir do XLSX
const occurrences: Occurrence[] = importOccurrencesFromXlsx(xlsxPath);

// Gera o arquivo TypeScript com os dados prontos para o app
const targetPath = join(__dirname, '..', 'src', 'data', 'occurrences.ts');

const content =
  `import type { Occurrence } from '../types/occurrence';\n\n` +
  `export const OCCURRENCES: Occurrence[] = ${JSON.stringify(occurrences, null, 2)};\n`;

writeFileSync(targetPath, content, 'utf8');

console.log(`Gerado src/data/occurrences.ts com ${occurrences.length} ocorrências.`);

