import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { RainStation } from '../types/rain';
import { getRainLevel } from '../utils/rainLevel';

interface RainDataTableProps {
  stations: RainStation[];
  embedded?: boolean;
  /** Exibe coluna "Acumulado" com station.accumulated.mm_accumulated (período escolhido no histórico) */
  showAccumulatedColumn?: boolean;
}

type SortField = 'name' | 'm05' | 'm15' | 'h01' | 'h24' | 'accumulated';
type SortDirection = 'asc' | 'desc';

export const RainDataTable: React.FC<RainDataTableProps> = ({ stations, embedded = false, showAccumulatedColumn = false }) => {
  const [sortField, setSortField] = useState<SortField>('h01');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' 
        ? aValue - bValue
        : bValue - aValue;
    }

    return 0;
  });

  const getSortIcon = (field: SortField) => {
    const sizeClass = embedded ? 'w-3 h-3' : 'w-4 h-4';
    if (sortField !== field) {
      return <ChevronUp className={`${sizeClass} text-gray-400`} />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className={`${sizeClass} text-blue-600`} />
      : <ChevronDown className={`${sizeClass} text-blue-600`} />;
  };

  return (
    <div className={`${embedded ? 'bg-white rounded-xl shadow-lg' : 'bg-white rounded-xl sm:rounded-2xl shadow-lg'} overflow-hidden`}>
      <div className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 bg-white border-b border-gray-200">
        <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-800">Dados Pluviométricos</h3>
      </div>
      
      {/* Mobile View - Cards */}
      <div className="block sm:hidden">
        <div className="divide-y divide-gray-200">
          {sortedStations.map((station) => {
            const rainLevel = getRainLevel(station.data.h01);
            const isHighRainfall =
              station.data.m05 > 0 ||
              station.data.m15 > 0 ||
              station.data.h01 > 0;
            
            return (
              <div 
                key={station.id}
                className={`px-3 py-2 transition-colors ${
                  isHighRainfall ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div 
                      className="w-3 h-3 rounded-full border border-white shadow-sm flex-shrink-0"
                      style={{ backgroundColor: rainLevel.color }}
                    ></div>
                    <span className="text-xs font-medium text-gray-900 truncate">
                      {station.name}
                    </span>
                  </div>
                  <div className={`grid gap-2 text-xs font-semibold ${showAccumulatedColumn ? 'grid-cols-5' : 'grid-cols-4'}`}>
                    <div className="text-right">
                      <div className="text-gray-500">5m</div>
                      <div className={station.data.m05 > 0 ? 'text-blue-700' : 'text-gray-500'}>
                        {station.data.m05.toFixed(1)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-500">15m</div>
                      <div className={station.data.m15 > 0 ? 'text-blue-700' : 'text-gray-500'}>
                        {station.data.m15.toFixed(1)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-500">1h</div>
                      <div className={station.data.h01 > 0 ? 'text-blue-700' : 'text-gray-500'}>
                        {station.data.h01.toFixed(1)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-500">24h</div>
                      <div className={station.data.h24 > 0 ? 'text-blue-700' : 'text-gray-500'}>
                        {station.data.h24.toFixed(1)}
                      </div>
                    </div>
                    {showAccumulatedColumn && (
                      <div className="text-right bg-blue-50/50 rounded px-0.5">
                        <div className="text-gray-500">Acum.</div>
                        <div className={(station.accumulated?.mm_accumulated ?? 0) > 0 ? 'text-blue-700' : 'text-gray-500'}>
                          {(station.accumulated?.mm_accumulated ?? 0).toFixed(1)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Desktop View - Table */}
      <div className={`hidden sm:block ${embedded ? '' : 'overflow-x-auto'}`}>
        <table className={`w-full ${embedded ? 'table-fixed' : 'min-w-[520px]'}`}>
          {embedded && (
            <colgroup>
              <col style={{ width: showAccumulatedColumn ? '38%' : '44%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
              {showAccumulatedColumn && <col style={{ width: '14%' }} />}
            </colgroup>
          )}
          <thead className="bg-gray-50">
            <tr>
              <th 
                className={`${embedded ? 'px-2 py-1.5 text-[11px]' : 'px-3 lg:px-4 py-2 lg:py-3 text-xs lg:text-sm'} text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors`}
                onClick={() => handleSort('name')}
              >
                <div className={`flex items-center ${embedded ? 'gap-0.5' : 'gap-1 lg:gap-2'}`}>
                  Estação
                  {getSortIcon('name')}
                </div>
              </th>
              <th 
                className={`${embedded ? 'px-1.5 py-1.5 text-[11px]' : 'px-3 lg:px-4 py-2 lg:py-3 text-xs lg:text-sm'} text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors`}
                onClick={() => handleSort('m05')}
              >
                <div className={`flex items-center justify-end ${embedded ? 'gap-0.5' : 'gap-1 lg:gap-2'}`}>
                  {getSortIcon('m05')}
                  {embedded ? '5m' : '5min'}
                </div>
              </th>
              <th 
                className={`${embedded ? 'px-1.5 py-1.5 text-[11px]' : 'px-3 lg:px-4 py-2 lg:py-3 text-xs lg:text-sm'} text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors`}
                onClick={() => handleSort('m15')}
              >
                <div className={`flex items-center justify-end ${embedded ? 'gap-0.5' : 'gap-1 lg:gap-2'}`}>
                  {getSortIcon('m15')}
                  {embedded ? '15m' : '15min'}
                </div>
              </th>
              <th 
                className={`${embedded ? 'px-1.5 py-1.5 text-[11px]' : 'px-3 lg:px-4 py-2 lg:py-3 text-xs lg:text-sm'} text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors`}
                onClick={() => handleSort('h01')}
              >
                <div className={`flex items-center justify-end ${embedded ? 'gap-0.5' : 'gap-1 lg:gap-2'}`}>
                  {getSortIcon('h01')}
                  1h
                </div>
              </th>
              <th 
                className={`${embedded ? 'px-1.5 py-1.5 text-[11px]' : 'px-3 lg:px-4 py-2 lg:py-3 text-xs lg:text-sm'} text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors`}
                onClick={() => handleSort('h24')}
              >
                <div className={`flex items-center justify-end ${embedded ? 'gap-0.5' : 'gap-1 lg:gap-2'}`}>
                  {getSortIcon('h24')}
                  24h
                </div>
              </th>
              {showAccumulatedColumn && (
                <th 
                  className={`${embedded ? 'px-1.5 py-1.5 text-[11px]' : 'px-3 lg:px-4 py-2 lg:py-3 text-xs lg:text-sm'} text-right font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors bg-blue-50`}
                  onClick={() => handleSort('accumulated')}
                  title="Acumulado no período (De/Até + horários)"
                >
                  <div className={`flex items-center justify-end ${embedded ? 'gap-0.5' : 'gap-1 lg:gap-2'}`}>
                    {getSortIcon('accumulated')}
                    {embedded ? 'Acum.' : 'Acumulado'}
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedStations.map((station) => {
              const rainLevel = getRainLevel(station.data.h01);
              const isHighRainfall =
                station.data.m05 > 0 ||
                station.data.m15 > 0 ||
                station.data.h01 > 0;
              
              return (
                <tr 
                  key={station.id}
                  className={`hover:bg-gray-50 transition-colors ${
                    isHighRainfall ? 'bg-blue-50' : ''
                  }`}
                >
                  <td className={`${embedded ? 'px-2 py-1.5' : 'px-3 lg:px-4 py-2 lg:py-3'}`}>
                    <div className={`flex items-center ${embedded ? 'gap-1.5' : 'gap-2 lg:gap-3'}`}>
                      <div 
                        className={`${embedded ? 'w-2.5 h-2.5' : 'w-2.5 lg:w-3 h-2.5 lg:h-3'} rounded-full border border-white shadow-sm flex-shrink-0`}
                        style={{ backgroundColor: rainLevel.color }}
                      ></div>
                      <span className={`${embedded ? 'text-[11px]' : 'text-xs lg:text-sm'} font-medium text-gray-900 truncate`}>
                        {station.name}
                      </span>
                    </div>
                  </td>
                  <td className={`${embedded ? 'px-1.5 py-1.5' : 'px-3 lg:px-4 py-2 lg:py-3'} text-right`}>
                    <span className={`${embedded ? 'text-[11px]' : 'text-xs lg:text-sm'} font-semibold ${
                      station.data.m05 > 0 ? 'text-blue-700' : 'text-gray-500'
                    }`}>
                      {station.data.m05.toFixed(1)}
                    </span>
                  </td>
                  <td className={`${embedded ? 'px-1.5 py-1.5' : 'px-3 lg:px-4 py-2 lg:py-3'} text-right`}>
                    <span className={`${embedded ? 'text-[11px]' : 'text-xs lg:text-sm'} font-semibold ${
                      station.data.m15 > 0 ? 'text-blue-700' : 'text-gray-500'
                    }`}>
                      {station.data.m15.toFixed(1)}
                    </span>
                  </td>
                  <td className={`${embedded ? 'px-1.5 py-1.5' : 'px-3 lg:px-4 py-2 lg:py-3'} text-right`}>
                    <span className={`${embedded ? 'text-[11px]' : 'text-xs lg:text-sm'} font-semibold ${
                      station.data.h01 > 0 ? 'text-blue-700' : 'text-gray-500'
                    }`}>
                      {station.data.h01.toFixed(1)}
                    </span>
                  </td>
                  <td className={`${embedded ? 'px-1.5 py-1.5' : 'px-3 lg:px-4 py-2 lg:py-3'} text-right`}>
                    <span className={`${embedded ? 'text-[11px]' : 'text-xs lg:text-sm'} font-semibold ${
                      station.data.h24 > 0 ? 'text-blue-700' : 'text-gray-500'
                    }`}>
                      {station.data.h24.toFixed(1)}
                    </span>
                  </td>
                  {showAccumulatedColumn && (
                    <td className={`${embedded ? 'px-1.5 py-1.5' : 'px-3 lg:px-4 py-2 lg:py-3'} text-right bg-blue-50/50`}>
                      <span className={`${embedded ? 'text-[11px]' : 'text-xs lg:text-sm'} font-semibold ${
                        (station.accumulated?.mm_accumulated ?? 0) > 0 ? 'text-blue-700' : 'text-gray-500'
                      }`}>
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
