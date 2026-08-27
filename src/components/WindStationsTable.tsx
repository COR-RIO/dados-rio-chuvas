import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { WindStation } from '../types/wind';
import {
  msToKmh,
  windCategoryFromSpeedKmh,
  windDirectionToCardinal,
  isSignificantWindStation,
  WIND_CATEGORY_LABELS,
  WIND_CATEGORY_COLORS,
  WIND_CATEGORY_ORDER,
  WIND_CORRIDOR_LABELS,
} from '../types/wind';

interface WindStationsTableProps {
  stations: WindStation[];
  loading?: boolean;
  embedded?: boolean;
  /** Id da estação atualmente em foco no mapa (WindSpotlight) — fica sempre na primeira linha,
   * destacada, pra bater com o que está sendo mostrado no mapa. */
  spotlightStationId?: string | null;
  onFocusLocation?: (lat: number, lng: number) => void;
}

type SortField = 'name' | 'corridor' | 'windSpeedMs' | 'windGustMs' | 'observedAt' | 'category' | 'windDirectionDeg' | 'source';
type SortDirection = 'asc' | 'desc';

const SOURCE_LABEL: Record<'inmet' | 'redemet' | 'sempre', string> = { inmet: 'INMET', redemet: 'REDEMET', sempre: 'websempre' };

/**
 * Estações do cinturão de vento AO VIVO (INMET + REDEMET), em formato tabela — mesmo padrão
 * visual de RainDataTable/OccurrenceTable. Complementa WindEventsTable (que é só o histórico
 * forte/muito-forte, do BigQuery) com a visão "agora" de todas as estações reportando.
 */
export const WindStationsTable: React.FC<WindStationsTableProps> = ({
  stations,
  loading = false,
  embedded = false,
  spotlightStationId = null,
  onFocusLocation,
}) => {
  const [sortField, setSortField] = useState<SortField>('windGustMs');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [onlySignificant, setOnlySignificant] = useState(false);
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
  }, [stations, onlySignificant]);

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
        case 'windSpeedMs':
          comp = a.windSpeedMs - b.windSpeedMs;
          break;
        case 'windGustMs':
          comp = (a.windGustMs ?? a.windSpeedMs) - (b.windGustMs ?? b.windSpeedMs);
          break;
        case 'observedAt':
          comp = a.observedAt.localeCompare(b.observedAt);
          break;
        case 'category': {
          const catA = windCategoryFromSpeedKmh(msToKmh(a.windGustMs ?? a.windSpeedMs));
          const catB = windCategoryFromSpeedKmh(msToKmh(b.windGustMs ?? b.windSpeedMs));
          comp = WIND_CATEGORY_ORDER.indexOf(catA) - WIND_CATEGORY_ORDER.indexOf(catB);
          break;
        }
        case 'windDirectionDeg':
          comp = (a.windDirectionDeg ?? -1) - (b.windDirectionDeg ?? -1);
          break;
        case 'source':
          comp = SOURCE_LABEL[a.source].localeCompare(SOURCE_LABEL[b.source]);
          break;
      }
      return sortDirection === 'asc' ? comp : -comp;
    });
    return list;
  }, [stations, sortField, sortDirection]);

  const visible = useMemo(() => {
    const base = onlySignificant ? sorted.filter(isSignificantWindStation) : sorted;
    if (!spotlightStationId) return base;
    const idx = base.findIndex((s) => s.id === spotlightStationId);
    if (idx <= 0) return base; // não encontrada, ou já é a primeira
    const reordered = [...base];
    const [spotlighted] = reordered.splice(idx, 1);
    reordered.unshift(spotlighted);
    return reordered;
  }, [sorted, onlySignificant, spotlightStationId]);

  const stationCountLabel = onlySignificant
    ? `${visible.length} de ${sorted.length} estações`
    : `${sorted.length} estações`;
  // Compara por timestamp real (não por string): as fontes usam fusos diferentes no observedAt
  // (REDEMET "Z", SEMPRE "-03:00"), e comparar string fazia o header mostrar hora antiga.
  const latestObservedAt = stations.reduce<string | null>((latest, station) => {
    if (!latest || new Date(station.observedAt).getTime() > new Date(latest).getTime()) {
      return station.observedAt;
    }
    return latest;
  }, null);
  const latestTimeLabel = latestObservedAt
    ? new Date(latestObservedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null;

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
    'px-1.5 sm:px-2 py-1.5 sm:py-2 text-left text-[10px] sm:text-[11px] font-medium text-gray-700 cursor-pointer hover:bg-gray-100 whitespace-normal';
  const cellBase = 'px-1.5 sm:px-2 py-1.5 sm:py-2 text-[10px] sm:text-[11px] text-gray-800 align-top whitespace-normal break-words';

  return (
    <div className={`${embedded ? 'bg-white rounded-xl shadow-lg' : 'bg-white rounded-xl sm:rounded-2xl shadow-lg'} overflow-hidden`}>
      <div className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 bg-white border-b border-gray-200 flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-800">
          Cinturão de vento — agora{latestTimeLabel ? ` (${latestTimeLabel})` : ''}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOnlySignificant((prev) => !prev)}
            className={`px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-medium border transition-colors ${
              onlySignificant
                ? 'bg-amber-600 border-amber-600 text-white'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
            title="Mostrar só estações com vento forte ou muito forte"
          >
            Só forte/muito forte
          </button>
          <span className="min-w-[88px] text-right text-[10px] sm:text-[11px] font-medium text-gray-600">
            {stationCountLabel}
          </span>
        </div>
      </div>

      {!visible.length ? (
        <div className="py-8 flex items-center justify-center bg-white">
          <p className="text-xs sm:text-sm text-gray-500 px-4 text-center">
            Nenhuma estação com vento forte/muito forte no momento.
          </p>
        </div>
      ) : (
      <>
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
        <table ref={tableRef} className="w-full min-w-max" style={{ tableLayout: 'auto' }}>
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className={`${headerBase} w-[140px] min-w-[140px]`} onClick={() => handleSort('name')}>
                Estação
              </th>
              <th className={`${headerBase} w-[90px] min-w-[90px]`} onClick={() => handleSort('windSpeedMs')}>
                Vento méd.
              </th>
              <th className={`${headerBase} w-[90px] min-w-[90px]`} onClick={() => handleSort('windGustMs')}>
                Rajada
              </th>
              <th className={`${headerBase} w-[110px] min-w-[110px]`} onClick={() => handleSort('category')}>
                Categoria
              </th>
              <th className={`${headerBase} w-[95px] min-w-[95px]`} onClick={() => handleSort('windDirectionDeg')}>
                Direção
              </th>
              <th className={`${headerBase} w-[150px] min-w-[150px]`} onClick={() => handleSort('observedAt')}>
                Atualizado
              </th>
              <th className={`${headerBase} w-[180px] min-w-[180px]`} onClick={() => handleSort('corridor')}>
                Corredor
              </th>
              <th className={`${headerBase} w-[80px] min-w-[80px]`} onClick={() => handleSort('source')}>
                Fonte
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {visible.map((s) => {
              const speedKmh = msToKmh(s.windSpeedMs);
              const gustKmh = s.windGustMs != null ? msToKmh(s.windGustMs) : null;
              const category = windCategoryFromSpeedKmh(gustKmh ?? speedKmh);
              const dtLabel = new Date(s.observedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
              const isSpotlighted = s.id === spotlightStationId;
              const canFocus = Boolean(s.location?.[0] != null && s.location?.[1] != null);
              return (
                <tr
                  key={s.id}
                  className={`${isSpotlighted ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-gray-50'} ${canFocus ? 'cursor-pointer' : 'cursor-default'}`}
                  onClick={() => {
                    if (canFocus && onFocusLocation) {
                      onFocusLocation(s.location[0], s.location[1]);
                    }
                  }}
                  title={canFocus ? 'Ir para esta estação no mapa' : undefined}
                >
                  <td className={`${cellBase} w-[140px] min-w-[140px]`} title={s.name}>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-gray-900 break-words block">{s.name}</span>
                      {isSpotlighted && (
                        <span
                          className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500"
                          title="Em foco no mapa agora"
                        />
                      )}
                    </div>
                    <div className="text-gray-500 break-words">{s.code}{s.messageType ? ` · ${s.messageType}` : ''}</div>
                  </td>
                  <td className={`${cellBase} w-[90px] min-w-[90px]`}>{speedKmh.toFixed(1)} km/h</td>
                  <td className={`${cellBase} w-[90px] min-w-[90px] font-semibold`}>{gustKmh != null ? `${gustKmh.toFixed(1)} km/h` : '-'}</td>
                  <td className={`${cellBase} w-[110px] min-w-[110px]`}>
                    <span
                      className="px-1.5 py-0.5 rounded text-white text-[9px] font-medium inline-block"
                      style={{ backgroundColor: WIND_CATEGORY_COLORS[category] }}
                    >
                      {WIND_CATEGORY_LABELS[category]}
                    </span>
                  </td>
                  <td className={`${cellBase} w-[95px] min-w-[95px]`}>
                    {s.windDirectionDeg != null ? `${windDirectionToCardinal(s.windDirectionDeg)} (${s.windDirectionDeg}°)` : 'VRB'}
                  </td>
                  <td className={`${cellBase} w-[150px] min-w-[150px]`} title={dtLabel}>
                    {dtLabel}
                  </td>
                  <td className={`${cellBase} w-[180px] min-w-[180px]`} title={WIND_CORRIDOR_LABELS[s.corridor]}>
                    {WIND_CORRIDOR_LABELS[s.corridor]}
                  </td>
                  <td className={`${cellBase} w-[80px] min-w-[80px]`}>{SOURCE_LABEL[s.source]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </>
      )}

      <div className="px-3 sm:px-4 lg:px-6 py-2 lg:py-3 border-t border-gray-200 bg-white">
        <p className="text-[10px] sm:text-xs text-gray-500">
          Fonte: INMET + REDEMET (METAR/SPECI), ao vivo — atualiza a cada 5 min. Clique no cabeçalho para ordenar.
        </p>
      </div>
    </div>
  );
};
