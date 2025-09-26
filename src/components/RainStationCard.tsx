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
    <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-gray-500" />
          <div>
            <h3 className="text-lg font-bold text-gray-800">{station.name}</h3>
            <p className="text-sm text-gray-500">
              Lat: {station.location[0].toFixed(3)}, Lng: {station.location[1].toFixed(3)}
            </p>
          </div>
        </div>
        <div 
          className="w-4 h-4 rounded-full flex-shrink-0 ring-2 ring-white shadow-sm"
          style={{ backgroundColor: rainLevel.color }}
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-500 font-medium mb-1">Última hora</p>
          <p className="text-xl font-bold text-gray-800">{station.data.h01.toFixed(1)} mm</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-500 font-medium mb-1">Últimas 24h</p>
          <p className="text-xl font-bold text-gray-800">{station.data.h24.toFixed(1)} mm</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Clock className="w-3 h-3" />
        <span>Atualizado em {lastUpdate.toLocaleTimeString('pt-BR')}</span>
      </div>
    </div>
  );
};