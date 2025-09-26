import React from 'react';
import { rainLevels } from '../utils/rainLevel';

export const RainLegend: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Legenda</h3>
      <div className="space-y-3">
        {rainLevels.map((level, index) => (
          <div key={index} className="flex items-center gap-3">
            <div 
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: level.color }}
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-700">
                {level.name}
              </span>
              <span className="text-xs text-gray-500 ml-2">
                {level.description}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};