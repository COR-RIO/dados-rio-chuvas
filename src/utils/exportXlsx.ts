import type { RainStation } from '../types/rain';
import * as XLSX from 'xlsx';

export function exportRainDataTableXlsx(stations: RainStation[]) {
  if (!stations.length) return;

  const hasAccumulated = stations.some((s: any) => s.accumulated && s.accumulated.mm_accumulated != null);

  const rows = stations.map((s: any) => {
    const base: Record<string, unknown> = {
      Estacao: s.name,
      '5m (m05)': Number.isFinite(s.data.m05) ? s.data.m05 : 0,
      '15m (m15)': Number.isFinite(s.data.m15) ? s.data.m15 : 0,
      '1h (h01)': Number.isFinite(s.data.h01) ? s.data.h01 : 0,
      '24h (h24)': Number.isFinite(s.data.h24) ? s.data.h24 : 0,
    };

    if (hasAccumulated) {
      base['Acum. (mm)'] = s.accumulated?.mm_accumulated ?? 0;
    }

    base.Latitude = s.location[0];
    base.Longitude = s.location[1];
    base['Atualizado em'] = new Date(s.read_at).toLocaleString('pt-BR');

    return base;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados Pluviometricos');

  const now = new Date();
  const stamp = now.toISOString().replace(/[:T]/g, '-').split('.')[0];
  const filename = `dados-pluviometricos-${stamp}.xlsx`;

  XLSX.writeFile(workbook, filename);
}

