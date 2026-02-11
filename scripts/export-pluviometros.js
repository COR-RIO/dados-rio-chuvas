/**
 * Exporta a localização (latitude e longitude) de todos os pluviômetros
 * a partir da API da Prefeitura do Rio de Janeiro.
 * Uso: node scripts/export-pluviometros.js
 */

const API_URL = 'https://websempre.rio.rj.gov.br/json/chuvas';
const OUT_FILE = 'data/pluviometros.json';

async function exportPluviometros() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`API: ${res.status} ${res.statusText}`);
    const data = await res.json();
    const objects = data?.objects ?? [];
    const pluviometros = objects
      .filter((s) => s.kind === 'pluviometric')
      .map((s, i) => ({
        id: `rio-${String(s.name).toLowerCase().replace(/\s+/g, '-')}-${i}`,
        nome: s.name,
        latitude: Array.isArray(s.location) ? s.location[0] : null,
        longitude: Array.isArray(s.location) ? s.location[1] : null,
      }))
      .filter((p) => p.latitude != null && p.longitude != null);

    const fs = await import('fs');
    const path = await import('path');
    const dir = path.dirname(path.join(process.cwd(), OUT_FILE));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(process.cwd(), OUT_FILE),
      JSON.stringify({ pluviometros, total: pluviometros.length, atualizado_em: new Date().toISOString() }, null, 2),
      'utf8'
    );
    console.log(`OK: ${pluviometros.length} pluviômetros em ${OUT_FILE}`);
  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  }
}

exportPluviometros();
