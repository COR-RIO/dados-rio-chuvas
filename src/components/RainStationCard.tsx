import React from 'react';
import { MapPin, Clock } from 'lucide-react';
import { RainStation } from '../types/rain';
import { getRainLevel } from '../utils/rainLevel';

interface RainStationCardProps {
  station: RainStation;
}

export const RainStationCard: React.FC<RainStationCardProps> = ({ station }) => {
  const rainLevel = getRainLevel(station.data.h01);
  const lastUpdate = new Date(station.read_at);
  
  return (
    <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-3 sm:p-4 lg:p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm sm:text-base lg:text-lg font-bold text-gray-800 truncate">{station.name}</h3>
            <p className="text-xs sm:text-sm text-gray-500 truncate">
              Lat: {station.location[0].toFixed(3)}, Lng: {station.location[1].toFixed(3)}
            </p>
          </div>
        </div>
        <div 
          className="w-3 h-3 sm:w-4 sm:h-4 rounded-full flex-shrink-0 ring-2 ring-white shadow-sm"
          style={{ backgroundColor: rainLevel.color }}
        />
      </div>
      
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:gap-4 mb-3 sm:mb-4">
        <div className="bg-gray-50 rounded-lg sm:rounded-xl p-2 sm:p-3">
          <p className="text-xs text-gray-500 font-medium mb-1">Última hora</p>
          <p className="text-lg sm:text-xl font-bold text-gray-800">{station.data.h01.toFixed(1)} mm</p>
        </div>
        <div className="bg-gray-50 rounded-lg sm:rounded-xl p-2 sm:p-3">
          <p className="text-xs text-gray-500 font-medium mb-1">Últimas 24h</p>
          <p className="text-lg sm:text-xl font-bold text-gray-800">{station.data.h24.toFixed(1)} mm</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Clock className="w-3 h-3 flex-shrink-0" />
        <span className="truncate">Atualizado em {lastUpdate.toLocaleTimeString('pt-BR')}</span>
      </div>
    </div>
  );
};