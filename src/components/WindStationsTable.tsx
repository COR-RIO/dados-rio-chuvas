import React, { useMemo, useState } from 'react';
import type { WindStation } from '../types/wind';
import { msToKmh, windCategoryFromSpeedKmh, windDirectionToCardinal, WIND_CATEGORY_LABELS, WIND_CATEGORY_COLORS, WIND_CORRIDOR_LABELS } from '../types/wind';

interface WindStationsTableProps {
  stations: WindStation[];
  loading?: boolean;
  embedded?: boolean;
}

type SortField = 'name' | 'corridor' | 'windGustMs' | 'observedAt';
type SortDirection = 'asc' | 'desc';

const SOURCE_LABEL: Record<'inmet' | 'redemet', string> = { inmet: 'INMET', redemet: 'REDEMET' };

/**
 * Estações do cinturão de vento AO VIVO (INMET + REDEMET), em formato tabela — mesmo padrão
 * visual de RainDataTable/OccurrenceTable. Complementa WindEventsTable (que é só o histórico
 * forte/muito-forte, do BigQuery) com a visão "agora" de todas as estações reportando.
 */
export const WindStationsTable: React.FC<WindStationsTableProps> = ({ stations, loading = false, embedded = false }) => {
  const [sortField, setSortField] = useState<SortField>('windGustMs');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sorted = useMemo(() => {
    const list = [...stations];
    list.sort((a, b) => {
      let comp = 0;
      switch (sortField) {
        case 'name':
          comp = a.name.localeCompare(b.name);
          break;
        case 'corridor':
          comp = WIND_CORRIDOR_LABELS[a.corridor].localeCompare(WIND_CORRIDOR_LABELS[b.corridor]);
          break;
        case 'windGustMs':
          comp = (a.windGustMs ?? a.windSpeedMs) - (b.windGustMs ?? b.windSpeedMs);
          break;
        case 'observedAt':
          comp = a.observedAt.localeCompare(b.observedAt);
          break;
      }
      return sortDirection === 'asc' ? comp : -comp;
    });
    return list;
  }, [stations, sortField, sortDirection]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <p className="text-xs sm:text-sm text-gray-500 px-4 text-center">Carregando estações de vento…</p>
      </div>
    );
  }

  if (!sorted.length) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <p className="text-xs sm:text-sm text-gray-500 px-4 text-center">
          Nenhuma estação de vento disponível no momento.
        </p>
      </div>
    );
  }

  const headerBase =
    'px-1.5 sm:px-2 py-1.5 sm:py-2 text-left text-[10px] sm:text-[11px] font-medium text-gray-700 cursor-pointer hover:bg-gray-100';
  const cellBase = 'px-1.5 sm:px-2 py-1.5 sm:py-2 text-[10px] sm:text-[11px] text-gray-800 align-top';

  return (
    <div className={`${embedded ? 'bg-white rounded-xl shadow-lg' : 'bg-white rounded-xl sm:rounded-2xl shadow-lg'} overflow-hidden`}>
      <div className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 bg-white border-b border-gray-200 flex items-center justify-between gap-2">
        <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-800">Cinturão de vento — agora</h3>
        <span className="text-[10px] sm:text-[11px] text-gray-500">{sorted.length} estações</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className={`${headerBase} w-[130px] min-w-[130px] truncate`} onClick={() => handleSort('name')}>
                Estação
              </th>
              <th className={`${headerBase} w-[110px] min-w-[110px] truncate`} onClick={() => handleSort('corridor')}>
                Corredor
              </th>
              <th className={`${headerBase} w-[70px] min-w-[70px] truncate`}>Fonte</th>
              <th className={`${headerBase} w-[70px] min-w-[70px] truncate`}>Direção</th>
              <th className={`${headerBase} w-[70px] min-w-[70px] truncate`}>Vento méd.</th>
              <th className={`${headerBase} w-[80px] min-w-[80px] truncate`} onClick={() => handleSort('windGustMs')}>
                Rajada
              </th>
              <th className={`${headerBase} w-[90px] min-w-[90px] truncate`}>Categoria</th>
              <th className={`${headerBase} w-[100px] min-w-[100px] truncate`} onClick={() => handleSort('observedAt')}>
                Atualizado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sorted.map((s) => {
              const gustKmh = msToKmh(s.windGustMs ?? s.windSpeedMs);
              const speedKmh = msToKmh(s.windSpeedMs);
              const category = windCategoryFromSpeedKmh(gustKmh);
              const dtLabel = new Date(s.observedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
              return (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className={`${cellBase} w-[130px] min-w-[130px] truncate`} title={s.name}>
                    <span className="font-semibold text-gray-900">{s.name}</span>
                    <div className="text-gray-500">{s.code}{s.messageType ? ` · ${s.messageType}` : ''}</div>
                  </td>
                  <td className={`${cellBase} w-[110px] min-w-[110px] truncate`} title={WIND_CORRIDOR_LABELS[s.corridor]}>
                    {WIND_CORRIDOR_LABELS[s.corridor]}
                  </td>
                  <td className={`${cellBase} w-[70px] min-w-[70px] truncate`}>{SOURCE_LABEL[s.source]}</td>
                  <td className={`${cellBase} w-[70px] min-w-[70px] truncate`}>
                    {s.windDirectionDeg != null ? `${windDirectionToCardinal(s.windDirectionDeg)} (${s.windDirectionDeg}°)` : 'VRB'}
                  </td>
                  <td className={`${cellBase} w-[70px] min-w-[70px] truncate`}>{speedKmh.toFixed(0)} km/h</td>
                  <td className={`${cellBase} w-[80px] min-w-[80px] truncate font-semibold`}>{gustKmh.toFixed(0)} km/h</td>
                  <td className={`${cellBase} w-[90px] min-w-[90px] truncate`}>
                    <span
                      className="px-1.5 py-0.5 rounded text-white text-[9px] font-medium"
                      style={{ backgroundColor: WIND_CATEGORY_COLORS[category] }}
                    >
                      {WIND_CATEGORY_LABELS[category]}
                    </span>
                  </td>
                  <td className={`${cellBase} w-[100px] min-w-[100px] truncate`} title={dtLabel}>
                    {dtLabel}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-3 sm:px-4 lg:px-6 py-2 lg:py-3 border-t border-gray-200 bg-white">
        <p className="text-[10px] sm:text-xs text-gray-500">
          Fonte: INMET + REDEMET (METAR/SPECI), ao vivo — atualiza a cada 5 min. Clique no cabeçalho para ordenar.
        </p>
      </div>
    </div>
  );
};
