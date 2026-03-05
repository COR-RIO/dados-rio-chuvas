import React, { useState, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, Download } from 'lucide-react';
import { RainStation } from '../types/rain';
import { getRainLevel } from '../utils/rainLevel';
import { exportRainDataTableXlsx } from '../utils/exportXlsx';

interface RainDataTableProps {
  stations: RainStation[];
  embedded?: boolean;
  showAccumulatedColumn?: boolean;
}

type SortField = 'name' | 'm05' | 'm15' | 'h01' | 'h24' | 'accumulated';
type SortDirection = 'asc' | 'desc';

export const RainDataTable: React.FC<RainDataTableProps> = ({ stations, embedded = false, showAccumulatedColumn = false }) => {
  const [sortField, setSortField] = useState<SortField>('h01');
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
  }, [stations, showAccumulatedColumn]);

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
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedStations = [...stations].sort((a, b) => {
    let aValue: number | string;
    let bValue: number | string;
    switch (sortField) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'm05':
        aValue = a.data.m05;
        bValue = b.data.m05;
        break;
      case 'm15':
        aValue = a.data.m15;
        bValue = b.data.m15;
        break;
      case 'h01':
        aValue = a.data.h01;
        bValue = b.data.h01;
        break;
      case 'h24':
        aValue = a.data.h24;
        bValue = b.data.h24;
        break;
      case 'accumulated':
        aValue = a.accumulated?.mm_accumulated ?? -1;
        bValue = b.accumulated?.mm_accumulated ?? -1;
        break;
      default:
        return 0;
    }
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
    return 0;
  });

  const getSortIcon = (field: SortField) => {
    const sizeClass = embedded ? 'w-3 h-3' : 'w-4 h-4';
    if (sortField !== field) return <ChevronUp className={`${sizeClass} text-gray-400`} />;
    return sortDirection === 'asc' ? <ChevronUp className={`${sizeClass} text-blue-600`} /> : <ChevronDown className={`${sizeClass} text-blue-600`} />;
  };

  return (
    <div className={`${embedded ? 'bg-white rounded-xl shadow-lg' : 'bg-white rounded-xl sm:rounded-2xl shadow-lg'} overflow-hidden`}>
      <div className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 bg-white border-b border-gray-200 flex items-center justify-between gap-2">
        <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-800">Dados Pluviométricos</h3>
        <button
          type="button"
          onClick={() => exportRainDataTableXlsx(stations)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-[11px] sm:text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          title="Exportar tabela em XLSX"
        >
          <Download className="w-3.5 h-3.5" />
          Exportar XLSX
        </button>
      </div>

      {/* Barra de rolagem superior */}
      <div
        ref={topScrollRef}
        onScroll={handleTopScroll}
        className={`overflow-x-auto ${embedded ? 'min-w-0' : ''}`}
      >
        <div style={{ width: tableWidth > 0 ? `${tableWidth}px` : '100%', height: '1px' }}></div>
      </div>

      {/* Tabela como antes: colunas Estação | 5m | 15m | 1h | 24h | Acum.; valores alinhados sob cada coluna; scroll horizontal no mobile/tablet */}
      <div
        ref={bottomScrollRef}
        onScroll={handleBottomScroll}
        className={`overflow-x-auto ${embedded ? 'min-w-0' : ''}`}
      >
        <table ref={tableRef} className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th
                className="px-1.5 sm:px-2 py-1.5 sm:py-2 text-left text-[10px] sm:text-[11px] font-medium text-gray-700 cursor-pointer hover:bg-gray-100 min-w-[80px] w-[90px] sm:w-[110px] max-w-[150px]"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-0.5 sm:gap-1">
                  Estação
                  {getSortIcon('name')}
                </div>
              </th>
              <th
                className="px-0.5 sm:px-1 py-1.5 sm:py-2 text-right text-[10px] sm:text-[11px] font-medium text-gray-700 cursor-pointer hover:bg-gray-100 w-[30px] sm:w-[45px]"
                onClick={() => handleSort('m05')}
              >
                <div className="flex items-center justify-end gap-0.5 sm:gap-1">
                  {getSortIcon('m05')}
                  5m
                </div>
              </th>
              <th
                className="px-0.5 sm:px-1 py-1.5 sm:py-2 text-right text-[10px] sm:text-[11px] font-medium text-gray-700 cursor-pointer hover:bg-gray-100 w-[30px] sm:w-[45px]"
                onClick={() => handleSort('m15')}
              >
                <div className="flex items-center justify-end gap-0.5 sm:gap-1">
                  {getSortIcon('m15')}
                  15m
                </div>
              </th>
              <th
                className="px-0.5 sm:px-1 py-1.5 sm:py-2 text-right text-[10px] sm:text-[11px] font-medium text-gray-700 cursor-pointer hover:bg-gray-100 w-[30px] sm:w-[45px]"
                onClick={() => handleSort('h01')}
              >
                <div className="flex items-center justify-end gap-0.5 sm:gap-1">
                  {getSortIcon('h01')}
                  1h
                </div>
              </th>
              <th
                className="px-0.5 sm:px-1 py-1.5 sm:py-2 text-right text-[10px] sm:text-[11px] font-medium text-gray-700 cursor-pointer hover:bg-gray-100 w-[30px] sm:w-[45px]"
                onClick={() => handleSort('h24')}
              >
                <div className="flex items-center justify-end gap-0.5 sm:gap-1">
                  {getSortIcon('h24')}
                  24h
                </div>
              </th>
              {showAccumulatedColumn && (
                <th
                  className="px-0.5 sm:px-1 py-1.5 sm:py-2 text-right text-[10px] sm:text-[11px] font-medium text-gray-700 cursor-pointer hover:bg-gray-100 bg-blue-50 w-[35px] sm:w-[50px]"
                  onClick={() => handleSort('accumulated')}
                  title="Acumulado"
                >
                  <div className="flex items-center justify-end gap-0.5 sm:gap-1">
                    {getSortIcon('accumulated')}
                    Acum.
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedStations.map((station) => {
              const rainLevel = getRainLevel(station.data.h01);
              const isHighRainfall = station.data.m05 > 0 || station.data.m15 > 0 || station.data.h01 > 0;
              return (
                <tr key={station.id} className={isHighRainfall ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                  <td className="px-1.5 sm:px-2 py-1.5 sm:py-2 min-w-[80px] w-[130px] sm:w-[150px] max-w-[170px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full border border-white shadow-sm flex-shrink-0" style={{ backgroundColor: rainLevel.color }} />
                      <span className="text-[10px] sm:text-[11px] md:text-xs font-medium text-gray-900 truncate" title={station.name}>{station.name}</span>
                    </div>
                  </td>
                  <td className="px-0.5 sm:px-1 py-1.5 sm:py-2 text-right tabular-nums text-[10px] sm:text-[11px] font-semibold tracking-tighter sm:tracking-normal w-[30px] sm:w-[45px]">
                    <span className={station.data.m05 > 0 ? 'text-blue-700' : 'text-gray-500'}>{station.data.m05.toFixed(1)}</span>
                  </td>
                  <td className="px-0.5 sm:px-1 py-1.5 sm:py-2 text-right tabular-nums text-[10px] sm:text-[11px] font-semibold tracking-tighter sm:tracking-normal w-[30px] sm:w-[45px]">
                    <span className={station.data.m15 > 0 ? 'text-blue-700' : 'text-gray-500'}>{station.data.m15.toFixed(1)}</span>
                  </td>
                  <td className="px-0.5 sm:px-1 py-1.5 sm:py-2 text-right tabular-nums text-[10px] sm:text-[11px] font-semibold tracking-tighter sm:tracking-normal w-[30px] sm:w-[45px]">
                    <span className={station.data.h01 > 0 ? 'text-blue-700' : 'text-gray-500'}>{station.data.h01.toFixed(1)}</span>
                  </td>
                  <td className="px-0.5 sm:px-1 py-1.5 sm:py-2 text-right tabular-nums text-[10px] sm:text-[11px] font-semibold tracking-tighter sm:tracking-normal w-[30px] sm:w-[45px]">
                    <span className={station.data.h24 > 0 ? 'text-blue-700' : 'text-gray-500'}>{station.data.h24.toFixed(1)}</span>
                  </td>
                  {showAccumulatedColumn && (
                    <td className="px-0.5 sm:px-1 py-1.5 sm:py-2 text-right bg-blue-50/50 tabular-nums text-[10px] sm:text-[11px] font-semibold tracking-tighter sm:tracking-normal w-[35px] sm:w-[50px]">
                      <span className={(station.accumulated?.mm_accumulated ?? 0) > 0 ? 'text-blue-700' : 'text-gray-500'}>
                        {(station.accumulated?.mm_accumulated ?? 0).toFixed(1)}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-3 sm:px-4 lg:px-6 py-2 lg:py-3 border-t border-gray-200 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-gray-500">
          <span>Total: {stations.length} estações</span>
          <span>Dados em milímetros (mm)</span>
        </div>
        <div className="mt-1 text-[10px] text-gray-500">Fonte: Alerta Rio</div>
      </div>
    </div>
  );
};
