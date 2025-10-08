import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { RainStation } from '../types/rain';
import { getRainLevel } from '../utils/rainLevel';

interface RainDataTableProps {
  stations: RainStation[];
}

type SortField = 'name' | 'h01' | 'h24';
type SortDirection = 'asc' | 'desc';

export const RainDataTable: React.FC<RainDataTableProps> = ({ stations }) => {
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
      case 'h01':
        aValue = a.data.h01;
        bValue = b.data.h01;
        break;
      case 'h24':
        aValue = a.data.h24;
        bValue = b.data.h24;
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
    if (sortField !== field) {
      return <ChevronUp className="w-4 h-4 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-4 h-4 text-blue-600" />
      : <ChevronDown className="w-4 h-4 text-blue-600" />;
  };

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg overflow-hidden">
      <div className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-800">Dados Pluviométricos</h3>
      </div>
      
      {/* Mobile View - Cards */}
      <div className="block sm:hidden">
        <div className="divide-y divide-gray-200 max-h-80 overflow-y-auto">
          {sortedStations.map((station) => {
            const rainLevel = getRainLevel(station.data.h01);
            const isHighRainfall = station.data.h01 > 0;
            
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
                  <div className="flex items-center gap-3 text-xs font-semibold">
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
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Desktop View - Table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full min-w-[300px]">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-3 lg:px-4 py-2 lg:py-3 text-left text-xs lg:text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1 lg:gap-2">
                  Estação
                  {getSortIcon('name')}
                </div>
              </th>
              <th 
                className="px-3 lg:px-4 py-2 lg:py-3 text-right text-xs lg:text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('h01')}
              >
                <div className="flex items-center justify-end gap-1 lg:gap-2">
                  {getSortIcon('h01')}
                  1h
                </div>
              </th>
              <th 
                className="px-3 lg:px-4 py-2 lg:py-3 text-right text-xs lg:text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('h24')}
              >
                <div className="flex items-center justify-end gap-1 lg:gap-2">
                  {getSortIcon('h24')}
                  24h
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedStations.map((station) => {
              const rainLevel = getRainLevel(station.data.h01);
              const isHighRainfall = station.data.h01 > 0;
              
              return (
                <tr 
                  key={station.id}
                  className={`hover:bg-gray-50 transition-colors ${
                    isHighRainfall ? 'bg-blue-50' : ''
                  }`}
                >
                  <td className="px-3 lg:px-4 py-2 lg:py-3">
                    <div className="flex items-center gap-2 lg:gap-3">
                      <div 
                        className="w-2.5 lg:w-3 h-2.5 lg:h-3 rounded-full border border-white shadow-sm flex-shrink-0"
                        style={{ backgroundColor: rainLevel.color }}
                      ></div>
                      <span className="text-xs lg:text-sm font-medium text-gray-900 truncate">
                        {station.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 lg:px-4 py-2 lg:py-3 text-right">
                    <span className={`text-xs lg:text-sm font-semibold ${
                      station.data.h01 > 0 ? 'text-blue-700' : 'text-gray-500'
                    }`}>
                      {station.data.h01.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-3 lg:px-4 py-2 lg:py-3 text-right">
                    <span className={`text-xs lg:text-sm font-semibold ${
                      station.data.h24 > 0 ? 'text-blue-700' : 'text-gray-500'
                    }`}>
                      {station.data.h24.toFixed(1)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div className="px-3 sm:px-4 lg:px-6 py-2 lg:py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-gray-500">
          <span>Total: {stations.length} estações</span>
          <span>Dados em milímetros (mm)</span>
        </div>
      </div>
    </div>
  );
};
