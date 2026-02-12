/**
 * Gera o valor exato para colar em GOOGLE_APPLICATION_CREDENTIALS_JSON no Netlify.
 * Uso: node scripts/prepare-netlify-credentials.js
 *
 * O resultado é salvo em credentials/netlify-env-value.txt (não é commitado).
 * Copie TODO o conteúdo desse arquivo e cole no valor da variável no Netlify.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const credentialsPath = path.join(__dirname, '..', 'credentials', 'credentials.json');
const outputPath = path.join(__dirname, '..', 'credentials', 'netlify-env-value.txt');

if (!fs.existsSync(credentialsPath)) {
  console.error('Arquivo não encontrado:', credentialsPath);
  process.exit(1);
}

const raw = fs.readFileSync(credentialsPath, 'utf8');
let obj;
try {
  obj = JSON.parse(raw);
} catch (e) {
  console.error('credentials.json inválido:', e.message);
  process.exit(1);
}

// Uma única linha, sem espaços extras (formato que o Netlify espera)
const oneLine = JSON.stringify(obj);

fs.writeFileSync(outputPath, oneLine, 'utf8');

console.log('Valor gerado e salvo em: credentials/netlify-env-value.txt\n');
console.log('Próximos passos:');
console.log('1. Abra o arquivo credentials/netlify-env-value.txt');
console.log('2. Selecione TUDO (Ctrl+A) e copie (Ctrl+C)');
console.log('3. No Netlify: Site configuration → Environment variables');
console.log('4. Crie ou edite a variável GOOGLE_APPLICATION_CREDENTIALS_JSON');
console.log('5. Cole o valor (Ctrl+V) e salve');
console.log('6. Faça um redeploy do site');
console.log('\nTamanho do valor:', oneLine.length, 'caracteres');
