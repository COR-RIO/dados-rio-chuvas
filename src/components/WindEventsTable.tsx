import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { WindEventRecord } from '../services/windEventsApi';
import { windEventTimestamp } from '../services/windEventsApi';
import { WIND_CATEGORY_ORDER, WIND_CORRIDOR_LABELS, type WindCorridor } from '../types/wind';

interface WindEventsTableProps {
  events: WindEventRecord[];
  loading?: boolean;
  embedded?: boolean;
}

function corridorLabel(corredor: string | null): string {
  if (!corredor) return '-';
  return WIND_CORRIDOR_LABELS[corredor as WindCorridor] ?? corredor;
}

type SortField =
  | 'observed_at'
  | 'icao'
  | 'wind_speed_ms'
  | 'wind_gust_ms'
  | 'categoria'
  | 'wind_direction_deg'
  | 'corredor'
  | 'message_type'
  | 'fonte';
type SortDirection = 'asc' | 'desc';

const CATEGORY_LABEL: Record<string, string> = {
  forte: 'Forte',
  'muito-forte': 'Muito forte',
};

const CATEGORY_COLOR: Record<string, string> = {
  forte: '#E8792C',
  'muito-forte': '#C6273A',
};

function msToKmh(ms: number | null): number | null {
  return ms == null ? null : ms * 3.6;
}

/** Posição na escala oficial fraco/moderado/forte/muito-forte, pra ordenar por severidade em vez de alfabeticamente. */
function categoryRank(categoria: 'forte' | 'muito-forte' | null): number {
  return categoria == null ? -1 : WIND_CATEGORY_ORDER.indexOf(categoria);
}

/**
 * Eventos de vento forte/muito-forte no período (histórico, BigQuery — vento_eventos_fortes),
 * pro cruzamento de debriefing. Mesmo padrão visual de OccurrenceTable.
 */
export const WindEventsTable: React.FC<WindEventsTableProps> = ({ events, loading = false, embedded = false }) => {
  const [sortField, setSortField] = useState<SortField>('observed_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [tableWidth, setTableWidth] = useState(0);

  useEffect(() => {
    if (!tableRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setTableWidth(entry.contentRect.width);
      }
    });
    observer.observe(tableRef.current);
    return () => observer.disconnect();
  }, [events]);

  const handleTopScroll = () => {
    if (bottomScrollRef.current && topScrollRef.current) {
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleBottomScroll = () => {
    if (topScrollRef.current && bottomScrollRef.current) {
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sorted = useMemo(() => {
    const list = [...events];
    list.sort((a, b) => {
      let comp = 0;
      switch (sortField) {
        case 'observed_at':
          comp = windEventTimestamp(a).localeCompare(windEventTimestamp(b));
          break;
        case 'icao':
          comp = (a.icao ?? '').localeCompare(b.icao ?? '');
          break;
        case 'wind_speed_ms':
          comp = (a.wind_speed_ms ?? 0) - (b.wind_speed_ms ?? 0);
          break;
        case 'wind_gust_ms':
          comp = (a.wind_gust_ms ?? a.wind_speed_ms ?? 0) - (b.wind_gust_ms ?? b.wind_speed_ms ?? 0);
          break;
        case 'categoria':
          comp = categoryRank(a.categoria) - categoryRank(b.categoria);
          break;
        case 'wind_direction_deg':
          comp = (a.wind_direction_deg ?? -1) - (b.wind_direction_deg ?? -1);
          break;
        case 'corredor':
          comp = corridorLabel(a.corredor).localeCompare(corridorLabel(b.corredor));
          break;
        case 'message_type':
          comp = (a.message_type ?? '').localeCompare(b.message_type ?? '');
          break;
        case 'fonte':
          comp = (a.fonte ?? 'REDEMET').localeCompare(b.fonte ?? 'REDEMET');
          break;
      }
      return sortDirection === 'asc' ? comp : -comp;
    });
    return list;
  }, [events, sortField, sortDirection]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <p className="text-xs sm:text-sm text-gray-500 px-4 text-center">Carregando histórico de vento…</p>
      </div>
    );
  }

  if (!sorted.length) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <p className="text-xs sm:text-sm text-gray-500 px-4 text-center">
          Nenhum registro de vento forte/muito-forte no período selecionado.
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
        <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-800">
          Vento forte/muito forte no período
        </h3>
        <span className="text-[10px] sm:text-[11px] text-gray-500">{sorted.length} registros</span>
      </div>

      <div
        ref={topScrollRef}
        onScroll={handleTopScroll}
        className="overflow-x-auto border-b border-gray-200 bg-gray-50"
        style={{ scrollbarWidth: 'thin', msOverflowStyle: 'auto' }}
      >
        <div
          style={{
            width: tableWidth > 0 ? `${Math.max(tableWidth + 24, tableWidth)}px` : '100%',
            minWidth: '100%',
            height: '12px',
          }}
        />
      </div>
      <div ref={bottomScrollRef} onScroll={handleBottomScroll} className="overflow-auto max-h-[60vh]">
        <table ref={tableRef} className="w-full min-w-max table-fixed">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className={`${headerBase} w-[100px] min-w-[100px] truncate`} onClick={() => handleSort('icao')}>
                Estação
              </th>
              <th className={`${headerBase} w-[60px] min-w-[60px] truncate`} onClick={() => handleSort('wind_speed_ms')}>
                Vento méd.
              </th>
              <th className={`${headerBase} w-[65px] min-w-[65px] truncate`} onClick={() => handleSort('wind_gust_ms')}>
                Rajada
              </th>
              <th className={`${headerBase} w-[85px] min-w-[85px] truncate`} onClick={() => handleSort('categoria')}>
                Categoria
              </th>
              <th className={`${headerBase} w-[70px] min-w-[70px] truncate`} onClick={() => handleSort('wind_direction_deg')}>
                Direção
              </th>
              <th className={`${headerBase} w-[100px] min-w-[100px] truncate`} onClick={() => handleSort('observed_at')}>
                Atualizado
              </th>
              <th className={`${headerBase} w-[110px] min-w-[110px] truncate`} onClick={() => handleSort('corredor')}>
                Corredor
              </th>
              <th className={`${headerBase} w-[70px] min-w-[70px] truncate`}>Fonte</th>
              <th className={`${headerBase} w-[70px] min-w-[70px] truncate`} onClick={() => handleSort('message_type')}>
                Tipo
              </th>
              <th className={`${headerBase} min-w-[220px] truncate`}>METAR/SPECI bruto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sorted.map((ev, index) => {
              const ts = windEventTimestamp(ev);
              // Sem forçar timeZone: 'UTC' — mesmo formato da WindStationsTable (hora local do
              // navegador), senão os dois horários de "Atualizado" batem com rótulos iguais mas
              // valores ~3h diferentes entre tabela ao vivo e histórica.
              const dtLabel = ts
                ? new Date(ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                : '-';
              const gustKmh = msToKmh(ev.wind_gust_ms ?? ev.wind_speed_ms);
              const speedKmh = msToKmh(ev.wind_speed_ms);
              const category = ev.categoria ?? 'forte';
              return (
                <tr key={`${ev.icao}-${ts}-${index}`} className="hover:bg-gray-50">
                  <td className={`${cellBase} w-[100px] min-w-[100px] truncate`} title={ev.estacao_nome ?? undefined}>
                    <span className="font-semibold text-gray-900 truncate block">{ev.icao}</span>
                    <div className="text-gray-500 truncate">{ev.estacao_nome ?? '-'}</div>
                  </td>
                  <td className={`${cellBase} w-[60px] min-w-[60px] truncate`}>
                    {speedKmh != null ? `${speedKmh.toFixed(1)} km/h` : '-'}
                  </td>
                  <td className={`${cellBase} w-[65px] min-w-[65px] truncate font-semibold`}>
                    {gustKmh != null ? `${gustKmh.toFixed(1)} km/h` : '-'}
                  </td>
                  <td className={`${cellBase} w-[85px] min-w-[85px] truncate`}>
                    <span
                      className="px-1.5 py-0.5 rounded text-white text-[9px] font-medium"
                      style={{ backgroundColor: CATEGORY_COLOR[category] }}
                    >
                      {CATEGORY_LABEL[category] ?? category}
                    </span>
                  </td>
                  <td className={`${cellBase} w-[70px] min-w-[70px] truncate`}>
                    {ev.wind_direction_deg != null ? `${ev.wind_direction_deg}°` : 'VRB'}
                  </td>
                  <td className={`${cellBase} w-[100px] min-w-[100px] truncate`} title={ts}>
                    {dtLabel}
                  </td>
                  <td className={`${cellBase} w-[110px] min-w-[110px] truncate`} title={corridorLabel(ev.corredor)}>
                    {corridorLabel(ev.corredor)}
                  </td>
                  <td className={`${cellBase} w-[70px] min-w-[70px] truncate`}>{ev.fonte ?? 'REDEMET'}</td>
                  <td className={`${cellBase} w-[70px] min-w-[70px] truncate`}>
                    <span
                      className={`px-1.5 py-0.5 rounded text-white text-[9px] font-medium ${
                        ev.message_type === 'SPECI' ? 'bg-amber-600' : 'bg-gray-400'
                      }`}
                    >
                      {ev.message_type ?? '-'}
                    </span>
                  </td>
                  <td className={`${cellBase} min-w-[220px] truncate font-mono`} title={ev.raw ?? undefined}>
                    {ev.raw ?? '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-3 sm:px-4 lg:px-6 py-2 lg:py-3 border-t border-gray-200 bg-white">
        <p className="text-[10px] sm:text-xs text-gray-500">
          Fonte: REDEMET (METAR/SPECI), tabela vento_eventos_fortes (BigQuery). Limiar: rajada ≥ 52 km/h. Clique no cabeçalho para ordenar.
        </p>
      </div>
    </div>
  );
};
